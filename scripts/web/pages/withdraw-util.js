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
  const nonce = req.body.nonce;
  // loggingUtil.log(dateUtil.getDate(), 'nonce');// , nonce);
  const owner = req.body.owner;
  // loggingUtil.log(dateUtil.getDate(), 'owner');// , owner);
  const badNonce = await nonceUtil.isBadNonce(owner, nonce);
  if (badNonce) {
    const resp = {};
    resp.message = `Need to log in again, server side nonce hash has does not match blockchain nonce hash.`;
    resp.success = false;
    res.send(resp);
    return;
    loggingUtil.log(dateUtil.getDate(), 'FAILURE withdraw', 'bad nonce');
  }
  const amount = req.body.amount;
  const account = req.body.account;
  if ((account === undefined) || account.length == 0) {
    const resp = {};
    resp.message = `bad account '${account}'`;
    resp.success = false;
    res.send(resp);
    return;
    loggingUtil.log(dateUtil.getDate(), 'FAILURE withdraw', 'bad account', account);
  }
  const amountRaw = BigInt(bananojs.getRawStrFromBananoStr(amount.toString()));
  if (amountRaw <= BigInt(0)) {
    const resp = {};
    resp.message = `bad amount '${amount}'`;
    resp.success = false;
    res.send(resp);
    return;
    loggingUtil.log(dateUtil.getDate(), 'FAILURE withdraw', 'bad amount', amount);
  }

  const seed = seedUtil.getSeedFromOwner(owner);

  // side effect of caching the seed, in case the user withdraws immediately upon startup.
  await bananojsCacheUtil.getBananoAccountFromSeed(seed, config.walletSeedIx);

  // loggingUtil.log(dateUtil.getDate(), 'seed');// , seed);
  const message = await bananojsCacheUtil.sendBananoWithdrawalFromSeed(seed, config.walletSeedIx, account, amount);

  const resp = {}; ;
  resp.message = message;
  resp.success = true;
  // loggingUtil.log(dateUtil.getDate(), 'resp', resp);
  loggingUtil.log(dateUtil.getDate(), 'SUCCESS withdraw', message);

  res.send(resp);
};

// exports
module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.post = post;
