'use strict';
// libraries
import fs from 'fs';
import path from 'path';
import awaitSemaphore from 'await-semaphore';

// modules
import dateUtil from './date-util.js';

// constants
const DEBUG = false;

// variables
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

  if (!fs.existsSync(config.assetDataDir)) {
    fs.mkdirSync(config.assetDataDir, {recursive: true});
  }
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  mutex = undefined;
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

const freezeAsset = async (assetId, thawTimeMs, rarity) => {
  /* istanbul ignore if */
  if (assetId === undefined) {
    throw new Error('assetId is required.');
  };
  /* istanbul ignore if */
  if (thawTimeMs === undefined) {
    throw new Error('thawTimeMs is required.');
  };
  /* istanbul ignore if */
  if (rarity === undefined) {
    throw new Error('rarity is required.');
  };
  const mutexRelease = await mutex.acquire();
  try {
    const assetFileNm = getAssetFileNm(assetId);
    if (!fs.existsSync(assetFileNm)) {
      if (DEBUG) {
        loggingUtil.log(dateUtil.getDate(), 'freezing asset', assetId);
      }
      const filePtr = fs.openSync(assetFileNm, 'w');
      fs.writeSync(filePtr, JSON.stringify({thawTimeMs: thawTimeMs, rarity: rarity}));
      fs.closeSync(filePtr);
    }
  } finally {
    mutexRelease();
  }
};

const isAssetFrozen = async (assetId) => {
  const mutexRelease = await mutex.acquire();
  try {
    const assetFileNm = getAssetFileNm(assetId);
    return fs.existsSync(assetFileNm);
  } finally {
    mutexRelease();
  }
};

const getThawTimeMsInMutex = (assetId) => {
  const file = getAssetFileNm(assetId);
  if (fs.existsSync(file)) {
    const {birthtimeMs} = fs.statSync(file);
    const data = fs.readFileSync(file, 'UTF-8');
    if (data.length == 0) {
      return birthtimeMs;
    }
    const json = JSON.parse(data);
    const thawTimeMs = birthtimeMs + json.thawTimeMs;

    // loggingUtil.log(dateUtil.getDate(), 'getThawTimeMsInMutex', 'assetId', assetId,
    // 'birthtimeMs', birthtimeMs, 'json.thawTimeMs', json.thawTimeMs, 'thawTimeMs', thawTimeMs);
    return thawTimeMs;
  }
};

const getThawTimeMs = async (assetId) => {
  /* istanbul ignore if */
  if (assetId === undefined) {
    throw new Error('assetId is required.');
  };
  const mutexRelease = await mutex.acquire();
  try {
    return getThawTimeMsInMutex(assetId);
  } finally {
    mutexRelease();
  }
};

const getThawTimeByRarityMs = (rarity, cardCount) => {
  /* istanbul ignore if */
  if (rarity === undefined) {
    throw new Error('rarity is required.');
  };
  /* istanbul ignore if */
  if (cardCount === undefined) {
    throw new Error('cardCount is required.');
  };
  const thawTimeByRarityMs = parseInt(config.thawTimeByRarityMs[rarity], 0);
  let thawTime;
  let fromRarity;
  if (thawTimeByRarityMs <= 0) {
    thawTime = config.thawTimeMs;
    fromRarity = false;
  } else {
    thawTime = thawTimeByRarityMs;
    fromRarity = true;
  }

  const fromCardCount = cardCount * parseInt(config.thawTimeBonusPerCardMs, 10);
  thawTime += fromCardCount;

  loggingUtil.debug(dateUtil.getDate(), 'getThawTimeByRarityMs', 'rarity', rarity,
      'fromRarity', fromRarity, 'fromCardCount', fromCardCount, 'thawTime', thawTime);
  return thawTime;
};

const thawAssetIfItIsTime = async (assetId) => {
  /* istanbul ignore if */
  if (assetId === undefined) {
    throw new Error('assetId is required.');
  };
  const mutexRelease = await mutex.acquire();
  try {
    const thawTimeMs = getThawTimeMsInMutex(assetId);
    if (thawTimeMs !== undefined) {
      const nowTimeMs = Date.now();
      // const diffMs = nowTimeMs - thawTimeMs;
      // loggingUtil.log(dateUtil.getDate(), 'thawAssetIfItIsTime', 'thawTimeMs', thawTimeMs, 'nowTimeMs', nowTimeMs, 'diffMs', diffMs);
      if (thawTimeMs < nowTimeMs) {
        if (DEBUG) {
          loggingUtil.log(dateUtil.getDate(), 'thawing asset', assetId);
        }
        const file = getAssetFileNm(assetId);
        fs.unlinkSync(file);
      }
    }
  } finally {
    mutexRelease();
  }
};

const getFrozenAssetCountByRarityMap = async () => {
  const countByRarityMap = new Map();
  const mutexRelease = await mutex.acquire();
  try {
    if (fs.existsSync(config.assetDataDir)) {
      fs.readdirSync(config.assetDataDir).forEach((file) => {
        const fileNm = path.join(config.assetDataDir, file);
        const data = fs.readFileSync(fileNm, 'UTF-8');
        if (data.length !== 0) {
          const json = JSON.parse(data);
          const rarity = json.rarity;
          if (countByRarityMap.has(rarity)) {
            const count = countByRarityMap.get(rarity);
            countByRarityMap.set(rarity, count+1);
          } else {
            countByRarityMap.set(rarity, 1);
          }
        }
      });
    }
  } finally {
    mutexRelease();
  }
  return countByRarityMap;
};

const getTotalFrozenAssetCount = async () => {
  const mutexRelease = await mutex.acquire();
  try {
    if (fs.existsSync(config.assetDataDir)) {
      return fs.readdirSync(config.assetDataDir).length;
    } else {
      return 0;
    }
  } finally {
    mutexRelease();
  }
};

export default {
  init,
  deactivate,
  isAssetFrozen,
  freezeAsset,
  getThawTimeMs,
  thawAssetIfItIsTime,
  getTotalFrozenAssetCount,
  getThawTimeByRarityMs,
  getFrozenAssetCountByRarityMap,
};
