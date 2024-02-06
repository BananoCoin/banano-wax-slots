'use strict';
// libraries
import fs from 'fs';
import path from 'path';
import bananojs from '@bananocoin/bananojs';
import awaitSemaphore from 'await-semaphore';

// modules
import dateUtil from './date-util.js';

// constants

// variables
const trackedSeedSet = new Set();
const trackedAccountSet = new Set();
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let mutex;
/* eslint-enable no-unused-vars */

// functions
const init = (_config, _loggingUtil, _seed, _entropyList) => {
  /* istanbul ignore if */
  if (_config === undefined) {
    throw new Error('config is required.');
  }
  /* istanbul ignore if */
  if (_loggingUtil === undefined) {
    throw new Error('loggingUtil is required.');
  };
  config = _config;
  loggingUtil = _loggingUtil;
  mutex = new awaitSemaphore.Mutex();

  if (!fs.existsSync(config.bananojsCacheDataDir)) {
    fs.mkdirSync(config.bananojsCacheDataDir, {recursive: true});
  }
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  mutex = undefined;
  /* eslint-enable no-unused-vars */
  trackedSeedSet.clear();
  trackedAccountSet.clear();
};

const getBananoAccountFromSeed = async (seed, seedIx) => {
  if (seed === undefined) {
    throw new Error('seed is required.');
  };
  if (seedIx === undefined) {
    throw new Error('seedIx is required.');
  };
  const account = await bananojs.getBananoAccountFromSeed(seed, seedIx);
  // if (seed !== config.centralWalletSeed) {
  trackedSeedSet.add(seed);
  trackedAccountSet.add(account);
  // }
  return account;
};

const getAccountsPending = async (accounts, count, source) => {
  if (accounts === undefined) {
    throw new Error('accounts is required.');
  };
  if (count === undefined) {
    throw new Error('count is required.');
  };
  if (source === undefined) {
    throw new Error('source is required.');
  };
  return await bananojs.getAccountsPending(accounts, count, source);
};

const getAccountFile = (account) => {
  if (account === undefined) {
    throw new Error('account is required.');
  };
  return path.join(config.bananojsCacheDataDir, account);
};

const saveAccountDataJson = (account, data) => {
  const accountFile = getAccountFile(account);
  const accountFilePtr = fs.openSync(accountFile, 'w');
  fs.writeSync(accountFilePtr, JSON.stringify(data));
  fs.closeSync(accountFilePtr);
};

const getAccountData = (account) => {
  const accountFile = getAccountFile(account);
  if (!fs.existsSync(accountFile)) {
    saveAccountDataJson(account, {'balance': '0'});
  }
  const data = fs.readFileSync(accountFile, 'UTF-8');
  return JSON.parse(data);
};

const receiveBananoDepositsForSeed = async (seed, seedIx, representative, hash) => {
  const response = await bananojs.receiveBananoDepositsForSeed(seed, seedIx, representative, hash);
  const account = await bananojs.getBananoAccountFromSeed(seed, seedIx);
  const centralAccount = await bananojs.getBananoAccountFromSeed(config.centralWalletSeed, config.walletSeedIx);

  if (account != centralAccount) {
    const accountInfo = await bananojs.getAccountInfo(account, true);
    const balanceParts = await bananojs.getBananoPartsFromRaw(accountInfo.balance);
    const bananoDecimal = await bananojs.getBananoPartsAsDecimal(balanceParts);

    loggingUtil.log('sweeping', bananoDecimal, 'banano from account', account, 'to central wallet', centralAccount);

    await bananojs.sendBananoWithdrawalFromSeed(seed, seedIx, centralAccount, bananoDecimal);

    const mutexRelease = await mutex.acquire();
    try {
      const accountData = getAccountData(account);
      loggingUtil.log('sweeping old accountData', account, accountData);
      accountData.balance = (BigInt(accountData.balance) + BigInt(accountInfo.balance)).toString();
      loggingUtil.log('sweeping new accountData', account, accountData);
      saveAccountDataJson(account, accountData);
    } finally {
      mutexRelease();
    }
  }
  return response;
};

const getAccountInfo = async (account, representativeFlag) => {
  const accountInfo = await bananojs.getAccountInfo(account, true);
  if (trackedAccountSet.has(account)) {
    const mutexRelease = await mutex.acquire();
    try {
      const accountData = getAccountData(account);
      accountInfo.cacheBalance = accountData.balance;
    } finally {
      mutexRelease();
    }
  }
  return accountInfo;
};

const sendBananoWithdrawalFromSeed = async (seed, seedIx, toAccount, amountBananos) => {
  const fromAccount = await bananojs.getBananoAccountFromSeed(seed, seedIx);
  // console.log(dateUtil.getDate(), 'withdraw from account', fromAccount, 'toAccount', toAccount, 'amountBananos', amountBananos);
  if (trackedSeedSet.has(seed)) {
    const mutexRelease = await mutex.acquire();
    try {
      if (fromAccount == toAccount) {
        return 'failure, cannot send to yourself';
      }
      const fromAccountData = getAccountData(fromAccount);
      const fromAccountBalance = BigInt(fromAccountData.balance);
      const amountRaw = BigInt(bananojs.getRawStrFromBananoStr(amountBananos.toString()));
      if (fromAccountBalance < amountRaw) {
        const fromAccountBalanceParts = await bananojs.getBananoPartsFromRaw(fromAccountData.balance);
        const fromAccountMajorAmount = fromAccountBalanceParts[fromAccountBalanceParts.majorName];
        const amountBalanceParts = await bananojs.getBananoPartsFromRaw(amountRaw);
        const amountBalanceMajorAmount = amountBalanceParts[amountBalanceParts.majorName];
        throw Error(`Error: The server's account balance of ${fromAccountMajorAmount} bananos in ${fromAccount} is too small, cannot withdraw ${amountBalanceMajorAmount} bananos. In raw ${fromAccountBalance} < ${amountRaw}.`);
      }
      const toAccountData = getAccountData(toAccount);

      // console.log(dateUtil.getDate(), 'withdraw from account', fromAccount, 'toAccount', toAccount, 'amountRaw', amountRaw, 'old pool balance', fromAccountData.balance, 'old account balance', toAccountData.balance);

      fromAccountData.balance = (fromAccountBalance - amountRaw).toString();

      let message;
      if (trackedAccountSet.has(toAccount)) {
        toAccountData.balance = (BigInt(toAccountData.balance) + amountRaw).toString();
        // console.log(dateUtil.getDate(), 'transfer from pool wallet', fromAccount, 'toAccount', toAccount, 'amountRaw', amountRaw, 'new pool balance', fromAccountData.balance, 'new account balance', toAccountData.balance);
        message = 'success';
      } else {
        const account = await getBananoAccountFromSeed(config.centralWalletSeed, config.walletSeedIx);
        console.log(dateUtil.getDate(), 'withdraw from central wallet', account, 'toAccount', toAccount, 'amountBananos', amountBananos);
        message = await bananojs.sendBananoWithdrawalFromSeed(config.centralWalletSeed, config.walletSeedIx, toAccount, amountBananos);
      }
      saveAccountDataJson(fromAccount, fromAccountData);
      saveAccountDataJson(toAccount, toAccountData);
      if (message.length == 0) {
        return `failure, blank hash returned sending ${amountBananos} to ${toAccount}`;
      }
      return message;
    } finally {
      mutexRelease();
    }
  } else {
    return 'failure, untracked seed';
  }
};

const getTotalAccountCount = () => {
  if (fs.existsSync(config.bananojsCacheDataDir)) {
    return fs.readdirSync(config.bananojsCacheDataDir).length;
  } else {
    return 0;
  }
};

const getActiveAccountCount = () => {
  let count = 0;
  if (fs.existsSync(config.bananojsCacheDataDir)) {
    fs.readdirSync(config.bananojsCacheDataDir).forEach((file) => {
      const fileNm = path.join(config.bananojsCacheDataDir, file);
      const {mtimeMs} = fs.statSync(fileNm);
      const activeTimeMs = mtimeMs;
      const activeTimeCutoffMs = Date.now() - config.activeTimeMs;
      // loggingUtil.log(dateUtil.getDate(), 'file', file, 'activeTimeMs', activeTimeMs, 'activeTimeCutoffMs', activeTimeCutoffMs, 'diff', (activeTimeCutoffMs - activeTimeMs));
      if (activeTimeMs > activeTimeCutoffMs) {
        count++;
      }
    });
  }
  return count;
};

const auditCache = async () => {
  const centralAccount = await bananojs.getBananoAccountFromSeed(config.centralWalletSeed, config.walletSeedIx);
  const accountInfo = await bananojs.getAccountInfo(centralAccount, true);

  if (accountInfo.balance == undefined) {
    loggingUtil.log(dateUtil.getDate(), 'auditCache', 'centralAccount', centralAccount, 'no balance in accountInfo', accountInfo);
    return;
  }
  const balanceParts = await bananojs.getBananoPartsFromRaw(accountInfo.balance);
  const bananoDecimal = Number(await bananojs.getBananoPartsAsDecimal(balanceParts));
  let cacheBananoDecimal = 0;

  const mutexRelease = await mutex.acquire();
  try {
    const files = fs.readdirSync(config.bananojsCacheDataDir);

    loggingUtil.log(dateUtil.getDate(), 'STARTED', 'auditCache', 'account count', files.length);

    for (const file of files) {
      const fileNm = path.join(config.bananojsCacheDataDir, file);
      const data = fs.readFileSync(fileNm, 'UTF-8');
      try {
        const isValid = bananojs.getBananoAccountValidationInfo(file);
        const json = JSON.parse(data);
        const cacheBalanceParts = await bananojs.getBananoPartsFromRaw(json.balance);
        const cacheBalance = Number(await bananojs.getBananoPartsAsDecimal(cacheBalanceParts));
        if (!isValid.valid) {
          loggingUtil.log(dateUtil.getDate(), 'WARNING', 'auditCache', 'can remove from banano cache, not valid account', file);
        }
        if (cacheBalance == 0) {
          loggingUtil.log(dateUtil.getDate(), 'WARNING', 'auditCache', 'can remove from banano cache, no balance', file);
        }
        cacheBananoDecimal += cacheBalance;
      } catch (error) {
        loggingUtil.trace(dateUtil.getDate(), 'ERROR', 'auditCache', 'file', file, 'error', error.message, `data:'${data}'`);
      }
    }
    const excessInAccount = bananoDecimal - cacheBananoDecimal;
    loggingUtil.log(dateUtil.getDate(), 'SUCCESS', 'auditCache', 'cacheBananoDecimal', cacheBananoDecimal, 'bananoDecimal', bananoDecimal, 'excessInAccount', excessInAccount);
  } finally {
    mutexRelease();
  }
};

const getBananoDecimalAmountAsRaw = bananojs.getBananoDecimalAmountAsRaw;
const getRawStrFromBananoStr = bananojs.getRawStrFromBananoStr;
const setBananodeApiUrl = bananojs.setBananodeApiUrl;
const getBananoPartsFromRaw = bananojs.getBananoPartsFromRaw;
const getBananoPartsDescription = bananojs.getBananoPartsDescription;
const getBananoPartsAsDecimal = bananojs.getBananoPartsAsDecimal;

export default {
  init,
  deactivate,
  getBananoDecimalAmountAsRaw,
  getRawStrFromBananoStr,
  setBananodeApiUrl,
  getBananoPartsFromRaw,
  getBananoPartsDescription,
  getBananoPartsAsDecimal,
  getBananoAccountFromSeed,
  getAccountsPending,
  getAccountInfo,
  sendBananoWithdrawalFromSeed,
  receiveBananoDepositsForSeed,
  getTotalAccountCount,
  getActiveAccountCount,
  auditCache,
};
