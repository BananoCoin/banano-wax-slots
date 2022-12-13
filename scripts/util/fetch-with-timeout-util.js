'use strict';
// libraries
const fetch = require('node-fetch');
const dateUtil = require('./date-util.js');
const AbortController = require('abort-controller');

// constants

// variables
let config;
let loggingUtil;

// functions
const init = (_config, _loggingUtil) => {
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
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  /* eslint-enable no-unused-vars */
};

const delay = (time) => {
  // console.log('rate-limit', 'calling', 'delay');
  if (!isNaN(time)) {
    if (isFinite(time)) {
      return new Promise((resolve) => {
        const fn = () => {
          // console.log('rate-limit', 'done waiting', 'time', time);
          resolve();
        };
        setTimeout(fn, time);
      });
    }
  }
};


const fetchWithTimeout = async (url, options) => {
  // loggingUtil.log('fetchWithTimeout', 'url', url);
  if (options == undefined) {
    options = {};
  }
  if (options.headers == undefined) {
    options.headers = {};
  }
  if (options.headers['Content-Type'] === undefined) {
    options.headers['Content-Type'] = 'application/json';
  }
  if (options.size == undefined) {
    options.size = config.fetchMaxResponseSizeBytes;
  }

  const {timeout = config.fetchTimeout} = options;

  const controller = new AbortController();
  /* istanbul ignore next */
  const controllerTimeoutFn = () => {
    controller.abort();
  };
  const id = setTimeout(controllerTimeoutFn, timeout);
  const responseWrapper = {};
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    responseWrapper.headers = response.headers;
    responseWrapper.status = response.status;
    responseWrapper.statusText = response.statusText;
    responseWrapper.remaining = 0;
    // loggingUtil.log('fetchWithTimeout', 'options', options);
    responseWrapper.text = async () => {
      const text = await response.text();
      // loggingUtil.log('fetchWithTimeout', 'status', response.status);

      const limit = parseInt(response.headers.get('x-ratelimit-limit'), 10);
      const remaining = parseInt(response.headers.get('x-ratelimit-remaining'), 10);
      const reset = parseInt(response.headers.get('x-ratelimit-reset'), 10);
      const resetDate = new Date(reset*1000);
      const resetDiff = Math.round(((reset*1000) - Date.now()) / 1000);

      // console.log('headers', 'reset', reset);
      // console.log('headers', 'remaining', remaining);
      const time = Math.floor(Date.now() / 1000);
      // console.log('headers', 'timer', time);
      const timeRemaining = reset-time;
      const pauseTime = Math.floor((timeRemaining*1000.0)/(remaining+1));

      await delay(pauseTime);

      // loggingUtil.log('fetchWithTimeout', `${remaining} of ${limit} left, reset in ${resetDiff} sec at ${resetDate} (${reset})`);
      const message = `${remaining} of ${limit} left, delay ${pauseTime}, reset in ${resetDiff} sec at ${resetDate} (${reset})`;
      loggingUtil.debug(dateUtil.getDate(), 'fetchWithTimeout', message);

      responseWrapper.remaining = remaining;

      return text;
    };
    responseWrapper.json = async () => {
      if (response.status != 200) {
        throw Error(`status:'${response.status}' statusText:'${response.statusText}'`);
      }
      const text = await responseWrapper.text();


      if (responseWrapper.remaining == 0) {
        responseWrapper.status = 500;
        return {message: message};
      }

      if (config.fetchLogResponseSize) {

      }
      loggingUtil.log(dateUtil.getDate(), 'fetchWithTimeout', url, 'text.length', text.length, 'of', 'options.size', options.size);
      try {
        return JSON.parse(text);
      } catch (error) {
        const message = 'returned invalid json from ' + url;
        loggingUtil.log('fetchWithTimeout', message);
        responseWrapper.status = 500;
        return {message: message};
      }
    };
  } catch (error) {
    // console.trace(error);
    clearTimeout(id);
    if (error.message == 'The user aborted a request.') {
      error.message = `timeout waiting for response from url '${url}'`;
    }
    responseWrapper.status = 408;
    responseWrapper.statusText = error.message;
    responseWrapper.text = async () => {
      if (responseWrapper.status != 200) {
        throw Error(responseWrapper.statusText);
      }
    };
    responseWrapper.json = async () => {
      if (responseWrapper.status != 200) {
        throw Error(responseWrapper.statusText);
      }
    };
  } finally {
    clearTimeout(id);
  }
  return responseWrapper;
};

module.exports.fetchWithTimeout = fetchWithTimeout;
module.exports.init = init;
module.exports.deactivate = deactivate;
