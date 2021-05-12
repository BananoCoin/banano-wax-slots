'use strict';
// libraries
const blake = require('blakejs');
const fetch = require('node-fetch');

// modules

// constants

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
  waxRpc.history_get_actions = async (t, e, r) => {
    return new Promise((resolve, reject) => {
      const req = `{"account_name": "${t}", "pos": "${e}", "offset": "${r}"}`;
      // console.log('history_get_actions', 'req', req);
      fetch('https://wax.greymass.com/v1/history/get_actions', {
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
  const nonceHash = getNonceHash(nonce);
  const ownerActions = await waxRpc.history_get_actions(owner, -1, -2);
  const ownerAction = ownerActions.actions[0];
  let badNonce = false;
  if (ownerAction == undefined) {
    badNonce = true;
  } else if (ownerAction.action_trace == undefined) {
    badNonce = true;
  } else if (ownerAction.action_trace.act == undefined) {
    badNonce = true;
  } else if (ownerAction.action_trace.act.data == undefined) {
    badNonce = true;
  } else {
    const lastNonceHash = ownerAction.action_trace.act.data.assoc_id;
    if (lastNonceHash != nonceHash) {
      badNonce = true;
    }
  }
  return badNonce;
};

module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.isBadNonce = isBadNonce;
