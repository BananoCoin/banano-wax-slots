'use strict';
// libraries

// modules

// constants

// variables
const cacheMissCountMap = new Map();
const cacheHitCountMap = new Map();

/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
/* eslint-enable no-unused-vars */

// functions
const init = (_config, _loggingUtil) => {
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
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  /* eslint-enable no-unused-vars */
};

const getUsingNamedCache = async (name, map, key, cacheDurationMs, getFn) => {
  if (name === undefined) {
    throw new Error('name is required.');
  }
  if (map === undefined) {
    throw new Error('map is required.');
  }
  if (key === undefined) {
    throw new Error('key is required.');
  }
  if (cacheDurationMs === undefined) {
    throw new Error('cacheDurationMs is required.');
  }
  if (getFn === undefined) {
    throw new Error('getFn is required.');
  }
  const nowTimeMs = Date.now();
  loggingUtil.debug('getUsingCache', 'init', key);
  if (map.has(key)) {
    loggingUtil.debug('getUsingCache', 'cacheHit', key);
    const cacheData = map.get(key);
    if (cacheData.expireTimeMs < nowTimeMs) {
      loggingUtil.debug('getUsingCache', 'cacheExpired', key);
      map.delete(key);
    } else {
      loggingUtil.log('getUsingCache', 'cacheHitReturn', key,
          cacheData.expireTimeMs, '<', nowTimeMs, 'by',
          cacheData.expireTimeMs-nowTimeMs, 'ms', getFn);
      increment(cacheHitCountMap, name);
      return cacheData.data;
    }
  }
  loggingUtil.debug('getUsingCache', 'cacheMiss', key);
  const data = await getFn();
  const expireTimeMs = nowTimeMs + cacheDurationMs;
  const cacheData = {
    data: data,
    expireTimeMs: expireTimeMs,
  };
  loggingUtil.debug('getUsingCache', 'cacheStore', key);
  map.set(key, cacheData);
  loggingUtil.debug('getUsingCache', 'cacheMissReturn', key);
  increment(cacheMissCountMap, name);
  return data;
};

const getCacheSize = (map) => {
  let cacheSize = 0;
  for (const [key, cacheData] of map) {
    if (key !== undefined) {
      cacheSize += cacheData.data.length;
    }
  }
  return cacheSize;
};

const increment = (map, key) => {
  if (!map.has(key)) {
    map.set(key, 1);
  } else {
    map.set(key, map.get(key)+1);
  }
};

const getCacheMissCountMap = () => {
  return cacheMissCountMap;
};

const getCacheHitCountMap = () => {
  return cacheHitCountMap;
};

module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.getUsingNamedCache = getUsingNamedCache;
module.exports.getCacheSize = getCacheSize;
module.exports.getCacheMissCountMap = getCacheMissCountMap;
module.exports.getCacheHitCountMap = getCacheHitCountMap;
