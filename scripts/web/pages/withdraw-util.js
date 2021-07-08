'use strict';
// libraries

// modules
const dateUtil = require('../../util/date-util.js');
const bananojsCacheUtil = require('../../util/bananojs-cache-util.js');
const seedUtil = require('../../util/seed-util.js');
const nonceUtil = require('../../util/nonce-util.js');
const bananojs = require('@bananocoin/bananojs');

// constants

// variables

/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
/* eslint-enable no-unused-vars */

// functions
const init = async (_config, _loggingUtil) => {
  /* istanbul ignore if */
  if (_config === undefined) {
    throw new Error('config is required.');
  }
  /* istanbul ignore if */
  if (_loggingUtil === undefined) {
    throw new Error('loggingUtil is required.');
  }
  config = _config;
  loggingUtil = _loggingUtil;

  bananojsCacheUtil.setBananodeApiUrl(config.bananodeApiUrl);
};

const deactivate = async () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  /* eslint-enable no-unused-vars */
};

const post = async (context, req, res) => {
  try {
    return await postWithoutCatch(context, req, res);
  } catch (error) {
    console.log('withdrawUtil error', error.message);
    console.trace(error);
    const resp = {};
    resp.ready = false;
    resp.errorMessage = error.message;
    res.send(resp);
  }
};

const postWithoutCatch = async (context, req, res) => {
  loggingUtil.log(dateUtil.getDate(), 'STARTED withdraw');

  if (config.disableWithdraw) {
    const resp = {};
    res.status(401);
    resp.message = 'demo mode only, withdrawal is disabled';
    resp.success = false;
    res.send(resp);
    loggingUtil.log(dateUtil.getDate(), 'FAILURE withdraw', 'disabled');
    return;
  }
  const nonce = req.body.nonce;
  // loggingUtil.log(dateUtil.getDate(), 'nonce');// , nonce);
  const owner = req.body.owner;
  // loggingUtil.log(dateUtil.getDate(), 'owner');// , owner);
  const badNonce = await nonceUtil.isBadNonce(owner, nonce);
  if (badNonce) {
    const resp = {};
    resp.message = `Need to log in again, server side nonce hash has does not match blockchain nonce hash.`;
    resp.success = false;
    res.status(401);
    res.send(resp);
    loggingUtil.log(dateUtil.getDate(), 'FAILURE withdraw', 'bad nonce');
    return;
  }
  const amount = req.body.amount;
  const account = req.body.account;
  if ((account === undefined) || account.length == 0) {
    const resp = {};
    resp.message = `bad account '${account}'`;
    resp.success = false;
    res.send(resp);
    res.status(409);
    loggingUtil.log(dateUtil.getDate(), 'FAILURE withdraw', 'bad account', account);
    return;
  }

  const amountRaw = BigInt(bananojs.getRawStrFromBananoStr(amount.toString()));
  if (amountRaw <= BigInt(0)) {
    const resp = {};
    res.status(409);
    resp.message = `bad amount '${amount}'`;
    resp.success = false;
    res.send(resp);
    loggingUtil.log(dateUtil.getDate(), 'FAILURE withdraw', resp.message);
    return;
  }

  const seed = seedUtil.getSeedFromOwner(owner);

  // side effect of caching the seed, in case the user withdraws immediately upon startup.
  await bananojsCacheUtil.getBananoAccountFromSeed(seed, config.walletSeedIx);

  const ownerAccount = await bananojsCacheUtil.getBananoAccountFromSeed(seed, config.walletSeedIx);

  const minWithdrawalBananosRaw = BigInt(bananojs.getRawStrFromBananoStr(config.minWithdrawalBananos.toString()));

  const accountInfo = await bananojsCacheUtil.getAccountInfo(ownerAccount, true);
  const balance = accountInfo.cacheBalance;
  const balanceParts = bananojsCacheUtil.getBananoPartsFromRaw(balance);
  delete balanceParts.raw;
  const balanceDecimal = bananojsCacheUtil.getBananoPartsAsDecimal(balanceParts);
  const balanceRaw = balance;

  if (balanceRaw <= minWithdrawalBananosRaw) {
    const resp = {};
    res.status(409);
    resp.message = `balance '${balanceDecimal}' is below minimum '${config.minWithdrawalBananos}'`;
    resp.success = false;
    res.send(resp);
    loggingUtil.log(dateUtil.getDate(), 'FAILURE withdraw', resp.message);
    return;
  }

  // loggingUtil.log(dateUtil.getDate(), 'seed');// , seed);
  try {
    const message = await bananojsCacheUtil.sendBananoWithdrawalFromSeed(seed, config.walletSeedIx, account, amount);

    const resp = {};
    resp.message = message;
    resp.success = true;
    if (message == 'cannot send to yourself') {
      resp.success = false;
    }
    // loggingUtil.log(dateUtil.getDate(), 'resp', resp);
    res.send(resp);
    loggingUtil.log(dateUtil.getDate(), 'SUCCESS withdraw', message);
  } catch (error) {
    const resp = {};
    resp.message = `error '${error.message}'`;
    resp.success = false;
    res.send(resp);
    loggingUtil.log(dateUtil.getDate(), 'FAILURE withdraw', 'error', error.message);
  }
};

// exports
module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.post = post;
