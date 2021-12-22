'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const awaitSemaphore = require('await-semaphore');

// modules

// constants

// variables

/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let mutex;
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
  mutex = new awaitSemaphore.Mutex();

  if (!fs.existsSync(config.bananoWalletDataDir)) {
    fs.mkdirSync(config.bananoWalletDataDir, {recursive: true});
  }
};

const deactivate = async () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  /* eslint-enable no-unused-vars */
};

const getOwnerFile = (owner) => {
  if (owner === undefined) {
    throw new Error('account is required.');
  };

  const seedHash = crypto.createHash('sha256')
      .update(`${owner}`)
      .digest();
  const fileNm = seedHash.toString('hex') + '.json';

  return path.join(config.bananoWalletDataDir, fileNm);
};

const loadOwnerAccount = async (owner) => {
  const mutexRelease = await mutex.acquire();
  try {
    const file = getOwnerFile(owner);
    if (fs.existsSync(file)) {
      const data = fs.readFileSync(file, 'UTF-8');
      const json = JSON.parse(data);
      return json.account;
    } else {
      return undefined;
    }
  } finally {
    mutexRelease();
  }
};

const getOwnersWithAccountsList = async () => {
  const mutexRelease = await mutex.acquire();
  try {
    const owners = [];
    if (fs.existsSync(config.bananoWalletDataDir)) {
      const list = fs.readdirSync(config.bananoWalletDataDir);
      for (let ix = 0; ix < list.length; ix++) {
        const nm = list[ix];
        const file = path.join(config.bananoWalletDataDir, nm);
        const data = fs.readFileSync(file, 'UTF-8');
        const json = JSON.parse(data);
        owners.push(json.owner);
      }
    }
    return owners;
  } finally {
    mutexRelease();
  }
};

const saveOwnerAccount = async (owner, account) => {
  const mutexRelease = await mutex.acquire();
  try {
    const file = getOwnerFile(owner);
    const filePtr = fs.openSync(file, 'w');
    fs.writeSync(filePtr, JSON.stringify({owner: owner, account: account}));
    fs.closeSync(filePtr);
  } finally {
    mutexRelease();
  }
};

// exports
module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.saveOwnerAccount = saveOwnerAccount;
module.exports.loadOwnerAccount = loadOwnerAccount;
module.exports.getOwnersWithAccountsList = getOwnersWithAccountsList;
