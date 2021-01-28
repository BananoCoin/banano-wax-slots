'use strict';
// libraries
const crypto = require('crypto');

// modules

// constants

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let seed;
// let entropyIx = 0;
const entropyList = [];
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
  }
  /* istanbul ignore if */
  if (_seed === undefined) {
    _seed = crypto.randomBytes(32);
  }
  /* istanbul ignore if */
  entropyList.length = 0;
  if (_entropyList !== undefined) {
    _entropyList.forEach((entropy) => {
      // console.log('entropyList', entropyList.length, entropy);
      entropyList.push(entropy);
    });
    // entropyIx = 0;
  }
  config = _config;
  loggingUtil = _loggingUtil;
  seed = _seed;
  fillEntropy();
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  seed = undefined;
  entropyList.length = 0;
  /* eslint-enable no-unused-vars */
};

const shuffle = (array) => {
  /* istanbul ignore if */
  if (array == undefined) {
    throw new Error('array is required.');
  }
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(getRandom(0, 1) * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

const fillEntropy = () => {
  if (entropyList.length < 32) {
    const seedHash = crypto.createHash('sha256')
        .update(seed)
        .digest();
    for (let x = 0; x < seedHash.length; x++) {
      entropyList.push(seedHash[x]);
    }
    seed = seedHash;
  }
};

const getRandom = (min, max) => {
  if (max == min) {
    return min;
  }
  const range = max - min;
  fillEntropy();
  let entropy = entropyList.shift();
  // console.log('entropy', entropyIx++, entropy);
  let maxEntropy = 256;
  while (maxEntropy < range) {
    fillEntropy();
    maxEntropy *= 256;
    entropy *= 256;
    entropy += entropyList.shift();
    // console.log('entropy', entropyIx++, entropy);
  }
  const scaledEntropy = (entropy / maxEntropy) * range;
  const retval = min + scaledEntropy;
  loggingUtil.debug('getRandom', min, max, range, entropy, maxEntropy, retval);
  return retval;
};

const getRandomInt = (min, max) => {
  return Math.floor(getRandom(Math.floor(min), Math.floor(max)));
};

const getTwoRandomArrayElts = (array) => {
  const ix0 = getRandomInt(0, array.length);
  const dx1 = getRandomInt(1, array.length -1);
  const ix1 = (ix0 + dx1) % array.length;
  return [
    array[ix0],
    array[ix1],
  ];
};

const getRandomArrayElt = (array) => {
  /* istanbul ignore if */
  if (array == undefined) {
    throw new Error('array is required.');
  }
  const ix = getRandomInt(0, array.length);
  return array[ix];
};

const getRandomHex32 = () => {
  return crypto.randomBytes(32).toString('hex');
};

const getRandomHex33 = () => {
  return crypto.randomBytes(33).toString('hex');
};

module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.getRandomArrayElt = getRandomArrayElt;
module.exports.getTwoRandomArrayElts = getTwoRandomArrayElts;
module.exports.shuffle = shuffle;
module.exports.getRandom = getRandom;
module.exports.getRandomInt = getRandomInt;
module.exports.getRandomHex32 = getRandomHex32;
module.exports.getRandomHex33 = getRandomHex33;
