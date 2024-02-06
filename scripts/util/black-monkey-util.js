'use strict';
// libraries
import fetch from 'node-fetch';

// modules

// constants

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let url;
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
  url = config.blackMonkeyCaptcha.url + '?level=' + config.blackMonkeyCaptcha.level + '&key='+ config.blackMonkeyCaptcha.key + '&png=true';
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  url = undefined;
  /* eslint-enable no-unused-vars */
};

const getImages = async () => {
  return new Promise((resolve, reject) => {
    // console.log('getImages', 'req', req);
    fetch(url, {
      method: 'get',
      headers: {'Content-Type': 'application/json'},
    })
        .catch((err) => reject(err))
        .then((res) => res.json())
        .then((json) => {
          // console.log('getImages', 'json', json);
          resolve(json);
        });
  });
};
export default {
  init,
  deactivate,
  getImages,
};
