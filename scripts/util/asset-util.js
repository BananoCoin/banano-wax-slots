'use strict';
// libraries
const fs = require('fs');
const path = require('path');

// modules
const dateUtil = require('./date-util.js');

// constants
const DEBUG = false;

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
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

  if (!fs.existsSync(config.assetDataDir)) {
    fs.mkdirSync(config.assetDataDir, {recursive: true});
  }
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  /* eslint-enable no-unused-vars */
};

const getAssetFileNm = (assetId) => {
  /* istanbul ignore if */
  if (assetId === undefined) {
    throw new Error('assetId is required.');
  };
  const assetFileNm = path.join(config.assetDataDir, assetId);
  return assetFileNm;
};

const freezeAsset = (assetId) => {
  const assetFileNm = getAssetFileNm(assetId);
  if (!fs.existsSync(assetFileNm)) {
    if (DEBUG) {
      loggingUtil.log(dateUtil.getDate(), 'freezing asset', assetId);
    }
    const assetFile = fs.openSync(assetFileNm, 'w');
    fs.closeSync(assetFile);
  }
};

const isAssetFrozen = (assetId) => {
  const assetFileNm = getAssetFileNm(assetId);
  return fs.existsSync(assetFileNm);
};

const getThawTimeMs = (assetId) => {
  const assetFileNm = getAssetFileNm(assetId);
  if (fs.existsSync(assetFileNm)) {
    const {birthtimeMs} = fs.statSync(assetFileNm);
    const thawTimeMs = birthtimeMs + config.thawTimeMs;
    const nowTimeMs = Date.now();
    const diffMs = thawTimeMs - nowTimeMs;
    // loggingUtil.log(dateUtil.getDate(), 'thawTimeMs', thawTimeMs, 'nowTimeMs', nowTimeMs);
    return diffMs;
  }
};

const thawAssetIfItIsTime = (assetId) => {
  const assetFileNm = getAssetFileNm(assetId);
  if (fs.existsSync(assetFileNm)) {
    const {birthtimeMs} = fs.statSync(assetFileNm);
    const thawTimeMs = birthtimeMs + config.thawTimeMs;
    const nowTimeMs = Date.now();
    // loggingUtil.log(dateUtil.getDate(), 'thawTimeMs', thawTimeMs, 'nowTimeMs', nowTimeMs);
    if (thawTimeMs < nowTimeMs) {
      if (DEBUG) {
        loggingUtil.log(dateUtil.getDate(), 'thawing asset', assetId);
      }
      fs.unlinkSync(assetFileNm);
    }
  }
};

const getTotalFrozenAssetCount = () => {
  if (fs.existsSync(config.assetDataDir)) {
    return fs.readdirSync(config.assetDataDir).length;
  } else {
    return 0;
  }
};

module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.isAssetFrozen = isAssetFrozen;
module.exports.freezeAsset = freezeAsset;
module.exports.getThawTimeMs = getThawTimeMs;
module.exports.thawAssetIfItIsTime = thawAssetIfItIsTime;
module.exports.getTotalFrozenAssetCount = getTotalFrozenAssetCount;
