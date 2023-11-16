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
  if (_config === undefined) {
    throw Error('config is required.');
  }
  if (_loggingUtil === undefined) {
    throw Error('loggingUtil is required.');
  }
  config = _config;
  loggingUtil = _loggingUtil;
};

const deactivate = () => {
  config = undefined;
  loggingUtil = undefined;
};

const getIp = (req) => {
  let ip;
  if (req.headers['x-forwarded-for'] !== undefined) {
    ip = req.headers['x-forwarded-for'];
  } else if (req.connection.remoteAddress == '::ffff:127.0.0.1') {
    ip = '::ffff:127.0.0.1';
  } else if (req.connection.remoteAddress == '::1') {
    ip = '::ffff:127.0.0.1';
  } else {
    ip = req.connection.remoteAddress;
  }
  // loggingUtil.log('ip', ip);
  return ip;
};

exports.init = init;
exports.deactivate = deactivate;
exports.getIp = getIp;
