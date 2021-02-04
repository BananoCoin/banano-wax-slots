'use strict';
// libraries
const crypto = require('crypto');

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

const getSeedFromOwner = (owner) => {
  const seedHash = crypto.createHash('sha256')
      .update(config.waxIdSeed)
      .update(`${owner}`)
      .digest();
  return seedHash.toString('hex');
};

module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.getSeedFromOwner = getSeedFromOwner;
