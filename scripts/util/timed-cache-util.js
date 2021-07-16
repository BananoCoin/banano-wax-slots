'use strict';
// libraries

// modules

// constants

// variables
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

const getUsingCache = async (map, key, cacheDurationMs, getFn) => {
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
  return data;
};

const getCacheSize = (map) => {
  let cacheSize = 0;
  for (const [key, cacheData] of map) {
    cacheSize += cacheData.data.length;
  }
  return cacheSize;
};

module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.getUsingCache = getUsingCache;
module.exports.getCacheSize = getCacheSize;
