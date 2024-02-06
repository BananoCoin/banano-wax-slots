'use strict';
// libraries

// modules
import assetUtil from './util/asset-util.js';
import bananojsCacheUtil from './util/bananojs-cache-util.js';
import dateUtil from './util/date-util.js';
import seedUtil from './util/seed-util.js';
import nonceUtil from './util/nonce-util.js';
import randomUtil from './util/random-util.js';
import timedCacheUtil from './util/timed-cache-util.js';
import atomicassetsUtil from './util/atomicassets-util.js';
import ownerAccountUtil from './util/owner-account-util.js';
import blackMonkeyUtil from './util/black-monkey-util.js';
import sanitizeBodyUtil from './util/sanitize-body-util.js';
import webPagePlayUtil from './web/pages/play-util.js';
import webPageWithdrawUtil from './web/pages/withdraw-util.js';
import webServerUtil from './web/server-util.js';
import fetchWithTimeoutUtil from './util/fetch-with-timeout-util.js';
import ipUtil from './util/ip-util.js';
import {readFile} from 'node:fs/promises';

// constants
let config;

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

  const CONFIG_URL = new URL('./config.json', import.meta.url);
  config = JSON.parse(await readFile(CONFIG_URL, 'utf8'));
  const CONFIG_OVERRIDE_URL = new URL('../config.json', import.meta.url);
  const configOverride = JSON.parse(await readFile(CONFIG_OVERRIDE_URL, 'utf8'));
  overrideConfig(configOverride, config);

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
  if (config.hcaptcha === undefined) {
    throw Error('hcaptcha is required in ./config.json');
  }
  if (config.hcaptcha.enabled) {
    if (config.hcaptcha.sitekey == '') {
      throw Error('hcaptcha sitekey is required in ./config.json');
    }
    if (config.hcaptcha.sitekey == '') {
      throw Error('hcaptcha secret is required in ./config.json');
    }
  }

  modules.push(fetchWithTimeoutUtil);
  modules.push(assetUtil);
  modules.push(bananojsCacheUtil);
  modules.push(dateUtil);
  modules.push(seedUtil);
  modules.push(nonceUtil);
  modules.push(randomUtil);
  modules.push(timedCacheUtil);
  modules.push(atomicassetsUtil);
  modules.push(ownerAccountUtil);
  modules.push(blackMonkeyUtil);
  modules.push(sanitizeBodyUtil);
  modules.push(webPagePlayUtil);
  modules.push(webPageWithdrawUtil);
  modules.push(webServerUtil);
  modules.push(ipUtil);

  for (let moduleIx = 0; moduleIx < modules.length; moduleIx++) {
    const item = modules[moduleIx];
    await item.init(config, loggingUtil);
  }

  await bananojsCacheUtil.auditCache();

  await atomicassetsUtil.setWaxApiAndAddTemplates();

  // await atomicassetsUtil.loadAllAssets();

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

const overrideConfig = (configOverride, config) => {
  loggingUtil.debug('STARTED overrideConfig', config);
  overrideValues(configOverride, config);
  loggingUtil.debug('SUCCESS overrideConfig', config);
};

init()
    .catch((e) => {
      console.log('FAILURE init.', e.message);
      console.trace('FAILURE init.', e);
    });
