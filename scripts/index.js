'use strict';
// libraries

// modules
const assetUtil = require('./util/asset-util.js');
const bananojsCacheUtil = require('./util/bananojs-cache-util.js');
const dateUtil = require('./util/date-util.js');
const seedUtil = require('./util/seed-util.js');
const nonceUtil = require('./util/nonce-util.js');
const randomUtil = require('./util/random-util.js');
const webPagePlayUtil = require('./web/pages/play-util.js');
const webPageWithdrawUtil = require('./web/pages/withdraw-util.js');
const webServerUtil = require('./web/server-util.js');

// constants
const config = require('./config.json');
const configOverride = require('../config.json');

const modules = [];

const loggingUtil = {};
loggingUtil.log = console.log;
loggingUtil.isDebugEnabled = () => {
  return false;
};
loggingUtil.debug = () => {};
// loggingUtil.debug = console.log;
loggingUtil.trace = console.trace;

const init = async () => {
  loggingUtil.log(dateUtil.getDate(), 'STARTED init');

  overrideConfig();

  if (config.cookieSecret == '') {
    throw Error('cookieSecret is required in ./config.json');
  }
  if (config.waxIdSeed == '') {
    throw Error('waxIdSeed is required in ./config.json');
  }
  if (config.burnAccount == '') {
    throw Error('burnAccount is required in ./config.json');
  }
  if (config.centralWalletSeed == '') {
    throw Error('centralWalletSeed is required in ./config.json');
  }
  if (config.houseWalletSeed == '') {
    throw Error('houseWalletSeed is required in ./config.json');
  }

  modules.push(assetUtil);
  modules.push(bananojsCacheUtil);
  modules.push(dateUtil);
  modules.push(seedUtil);
  modules.push(nonceUtil);
  modules.push(randomUtil);
  modules.push(webPagePlayUtil);
  modules.push(webPageWithdrawUtil);
  modules.push(webServerUtil);

  for (let moduleIx = 0; moduleIx < modules.length; moduleIx++) {
    const item = modules[moduleIx];
    await item.init(config, loggingUtil);
  }

  webServerUtil.setCloseProgramFunction(closeProgram);

  process.on('SIGINT', closeProgram);

  loggingUtil.log(dateUtil.getDate(), 'SUCCESS init');
};

const deactivate = async () => {
  loggingUtil.log(dateUtil.getDate(), 'STARTED deactivate');
  const reverseModules = modules.slice().reverse();
  for (let moduleIx = 0; moduleIx < reverseModules.length; moduleIx++) {
    const item = reverseModules[moduleIx];
    await item.deactivate(config, loggingUtil);
  }
  loggingUtil.log(dateUtil.getDate(), 'SUCCESS deactivate');
};

const closeProgram = async () => {
  console.log('STARTED closing program.');
  await deactivate();
  console.log('SUCCESS closing program.');
  process.exit(0);
};

const isObject = function(obj) {
  return (!!obj) && (obj.constructor === Object);
};

const overrideValues = (src, dest) => {
  Object.keys(src).forEach((key) => {
    const srcValue = src[key];
    const destValue = dest[key];
    if (isObject(destValue)) {
      overrideValues(srcValue, destValue);
    } else {
      dest[key] = srcValue;
    }
  });
};

const overrideConfig = () => {
  loggingUtil.debug('STARTED overrideConfig', config);
  overrideValues(configOverride, config);
  loggingUtil.debug('SUCCESS overrideConfig', config);
};

init()
    .catch((e) => {
      console.log('FAILURE init.', e.message);
      console.trace('FAILURE init.', e);
    });
