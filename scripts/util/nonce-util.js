'use strict';
// libraries
const blake = require('blakejs');
const fetch = require('node-fetch');

// modules
const randomUtil = require('./random-util.js');

// constants
const lastNonceByOwnerMap = new Map();

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let waxRpc;
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

  waxRpc = {};
  waxRpc.history_get_actions = async (t, skip, limit) => {
    return new Promise((resolve, reject) => {
      if (config.waxEndpointVersion == 'v1') {
        const urlBase = randomUtil.getRandomArrayElt(config.waxEndpointsV1);
        const req = `{"account_name": "${t}", "pos": "${e}", "offset": "${r}"}`;
        // console.log('history_get_actions', 'req', req);
        fetch(`'${urlBase}/v1/history/get_actions'`, {
          method: 'post',
          body: req,
          headers: {'Content-Type': 'application/json'},
        })
            .catch((err) => reject(err))
            .then((res) => res.json())
            .catch((err) => reject(err))
            .then((json) => {
              // console.log('history_get_actions', 'json', json);
              resolve(json);
            });
        return;
      }
      if ((config.waxEndpointVersion == 'v2') || (config.waxEndpointVersion == 'v2proxy')) {
        const urlBase = randomUtil.getRandomArrayElt(config.waxEndpointsV2);
        // console.log('history_get_actions', 'req', req);
        const urlStr = `${urlBase}/v2/history/get_actions`;
        const url = new URL(urlStr);
        url.searchParams.append('act.name', 'requestrand');
        // url.searchParams.append('act.data.assoc_id', nonce);
        url.searchParams.append('account', t);
        url.searchParams.append('skip', skip);
        url.searchParams.append('limit', limit);
        url.searchParams.append('simple', false);
        // console.log('history_get_actions', 'url', url);
        let endEarly = false;
        fetch(url, {
          method: 'get',
          headers: {'Content-Type': 'application/json'},
        })
            .catch((err) => {
              endEarly = true;
              reject(err);
            })
            .then((res) => {
              if (endEarly) {
                return;
              }
              return res.json();
            })
            .catch((err) => {
              endEarly = true;
              reject(err);
            })
            .then((json) => {
              if (endEarly) {
                return;
              }
              // console.log('history_get_actions', 'json', json);
              resolve(json);
            });
        return;
      }
      reject(Error(`unsupported value of config.waxEndpointVersion: '${config.waxEndpointVersion}'`));
    });
  };
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  waxRpc = undefined;
  /* eslint-enable no-unused-vars */
};

const getNonceHash = (nonce) => {
  const context = blake.blake2bInit(32, null);
  blake.blake2bUpdate(context, nonce);
  const nonceHash = getInt64StrFromUint8Array(blake.blake2bFinal(context));
  return nonceHash;
};

const bytesToHex = (bytes) => {
  return Array.prototype.map.call(bytes, (x) => ('00' + x.toString(16)).slice(-2)).join('').toUpperCase();
};

const getInt64StrFromUint8Array = (ba) => {
  const hex = bytesToHex(ba);
  const bi = BigInt('0x' + hex);
  const max = BigInt('0x7FFFFFFFFFFFFFFF');
  return (bi%max).toString();
};

const isBadNonce = async (owner, nonce) => {
  if (config.overrideNonce) {
    return false;
  }
  if (owner == undefined) {
    throw Error('owner is a required field');
  }
  if (nonce == undefined) {
    throw Error('nonce is a required field');
  }
  const nonceHash = getNonceHash(nonce);
  if (lastNonceByOwnerMap.has(owner)) {
    const lastNonceHash = lastNonceByOwnerMap.get(owner);
    // console.log('isBadNonce', 'cache', 'lastNonceHash', lastNonceHash, nonceHash);
    if (lastNonceHash == nonceHash) {
      return false;
    }
    lastNonceByOwnerMap.delete(owner);
  }
  // console.log('isBadNonce', 'owner', owner);
  // console.log('isBadNonce', 'nonce', nonce);
  const ownerActions = await waxRpc.history_get_actions(owner, 0, 10);
  // console.log('isBadNonce', 'ownerActions', ownerActions);
  let badNonce = false;
  if (ownerActions.actions == undefined) {
    badNonce = true;
  } else {
    let allNoncesBad = true;
    ownerActions.actions.forEach((ownerAction) => {
      // console.log('isBadNonce', 'ownerAction', ownerAction);
      if (ownerAction == undefined) {
        badNonce = true;
      } else if (ownerAction == undefined) {
        badNonce = true;
      } else if (ownerAction.act == undefined) {
        badNonce = true;
      } else if (ownerAction.act.data == undefined) {
        badNonce = true;
      } else {
        const lastNonceHash = ownerAction.act.data.assoc_id;
        const timestamp = ownerAction.timestamp;
        // console.log('isBadNonce', 'ownerAction.act', ownerAction.act);
        // console.log('isBadNonce', 'lastNonceHash', lastNonceHash);
        // console.log('isBadNonce', 'nonceHash', nonceHash);
        // console.log('isBadNonce', 'timestamp', timestamp);

        if (lastNonceHash == nonceHash) {
          allNoncesBad = false;
          lastNonceByOwnerMap.set(owner, lastNonceHash);
        }
      }
    });
    badNonce = false;
    if (allNoncesBad) {
      badNonce = true;
    }
  }
  return badNonce;
};

const getWaxRpc = () => {
  return waxRpc;
}

module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.isBadNonce = isBadNonce;
module.exports.getWaxRpc = getWaxRpc;
