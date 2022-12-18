'use strict';
// libraries
const fs = require('fs');
const path = require('path');
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

  if (!fs.existsSync(config.fetchLogsDataDir)) {
    fs.mkdirSync(config.fetchLogsDataDir, {recursive: true});
  }
  logFetchRotate(config.fetchLogRotateVerbose);
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
    if (config.fetchLogResponseSize) {
      logFetchRequest(dateUtil.getDate(), url);
    }

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
      if ((response.status != 200) && (response.status != 202)) {
        throw Error(`status:'${response.status}' statusText:'${response.statusText}'`);
      }
      const text = await responseWrapper.text();


      if (responseWrapper.remaining == 0) {
        responseWrapper.status = 500;
        return {message: message};
      }

      if (config.fetchLogResponseSize) {
        logFetchResponse(dateUtil.getDate(), url, text.length, options.size);
      }
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

const logFetchRequest = (date, url) => {
  // console.log('logFetchRequest', 'date', date, 'url', url);
  const logFileNm = path.join(config.fetchLogsDataDir, `${date}-001-request.txt`);
  if (!fs.existsSync(logFileNm)) {
    const header = '"date","url"\r\n';
    fs.appendFileSync(logFileNm, header);
  }
  const msg = `"${date}","${url}"\r\n`;
  fs.appendFileSync(logFileNm, msg);
  logFetchRotate(false);
};

const logFetchResponse = (date, url, length, max) => {
  // console.log('logFetchResponse', 'date', date, 'url', url, 'length', length, 'max', max);
  const logFileNm = path.join(config.fetchLogsDataDir, `${date}-002-response.txt`);
  if (!fs.existsSync(logFileNm)) {
    const header = '"date","url","length","max"\r\n';
    fs.appendFileSync(logFileNm, header);
  }
  const msg = `"${date}","${url}","${length}","${max}"\r\n`;
  fs.appendFileSync(logFileNm, msg);
  logFetchRotate(false);
};

const logFetchRotate = (verbose) => {
  if (fs.existsSync(config.fetchLogsDataDir)) {
    const getFullFileName = (file) => {
      return `${config.fetchLogsDataDir}/${file}`;
    };
    const files = fs.readdirSync(config.fetchLogsDataDir);
    const sortedFiles = files.sort((a, b) => {
      const aStat = fs.statSync(getFullFileName(a));
      const bStat = fs.statSync(getFullFileName(b));
      return new Date(bStat.birthtime).getTime() - new Date(aStat.birthtime).getTime();
    });
    if (verbose) {
      for (let fileIx = 0; fileIx < sortedFiles.length; fileIx++) {
        const file = sortedFiles[fileIx];
        const data = fs.readFileSync(getFullFileName(file), {encoding: 'utf8', flag: 'r'});
        const lines = data.split('\n');
        for (let lineIx = 0; lineIx < lines.length; lineIx++) {
          const line = lines[lineIx].trim();
          if (line.length > 0) {
            loggingUtil.log(dateUtil.getDate(), 'logFetchRotate', file, lineIx, line);
          }
        }
      }
    }

    const maxFileCount = config.fetchLogResponseMaxFileCount;
    for (let fileIx = 0; fileIx < sortedFiles.length; fileIx++) {
      const file = sortedFiles[fileIx];
      if (fileIx >= maxFileCount) {
        fs.unlinkSync(getFullFileName(file));
      }
    }

    // const remainingFiles = fs.readdirSync(config.fetchLogsDataDir);
    // console.log('logFetchRotate', 'maxFileCount', maxFileCount,
    //   'sortedFiles.length', sortedFiles.length,
    //   'remainingFiles.length', remainingFiles.length);
  }
};

module.exports.fetchWithTimeout = fetchWithTimeout;
module.exports.init = init;
module.exports.deactivate = deactivate;
