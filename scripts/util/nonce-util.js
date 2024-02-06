'use strict';
// libraries
import blake from 'blakejs';
// const fetch from 'node-fetch');

// modules
import randomUtil from './random-util.js';
import fetchWithTimeoutUtil from './fetch-with-timeout-util.js';

// constants
const fetch = fetchWithTimeoutUtil.fetchWithTimeout;

/** wax network, for both anchor and wax cloud wallet nonces. */
const waxLastNonceHashByOwnerMap = new Map();

/** cryptomonkeysConnect network, for connect.cryptomonkeys.cc nonces. */
const cmcLastNonceHashByOwnerMap = new Map();

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

  const toJson = async (url, res) => {
    if ((res.status !== 200)&&(res.status !== 202)) {
      throw Error(`url:'${url}' status:'${res.status}' statusText:'${res.statusText}'`);
    }
    const json = await res.json();
    // console.log('text',text)
    return json;
  };

  const newFetchPromise = async (url, method, body) => {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch(url, {
          method: method,
          body: body,
          headers: {'Content-Type': 'application/json'},
        });
        const json = await toJson(url, res);
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });
  };

  waxRpc = {};

  waxRpc.chain_push_transaction = async (bodyStr) => {
    const urlBase = randomUtil.getRandomArrayElt(config.waxEndpointsV2);
    const urlStr = '/v1/chain/push_transaction';
    const url = new URL(urlStr, urlBase);
    return newFetchPromise(url, 'post', bodyStr);
  };
  waxRpc.chain_get_required_keys = async (bodyStr) => {
    const urlBase = randomUtil.getRandomArrayElt(config.waxEndpointsV2);
    const urlStr = '/v1/chain/get_required_keys';
    const url = new URL(urlStr, urlBase);
    return newFetchPromise(url, 'post', bodyStr);
  };
  waxRpc.chain_get_raw_code_and_abi = async (bodyStr) => {
    const urlBase = randomUtil.getRandomArrayElt(config.waxEndpointsV2);
    const urlStr = '/v1/chain/get_raw_code_and_abi';
    const url = new URL(urlStr, urlBase);
    return newFetchPromise(url, 'post', bodyStr);
  };
  waxRpc.chain_get_info = async () => {
    const urlBase = randomUtil.getRandomArrayElt(config.waxEndpointsV2);
    const urlStr = '/v1/chain/get_info';
    const url = new URL(urlStr, urlBase);
    return newFetchPromise(url, 'get');
  };
  waxRpc.chain_get_block = async (bodyStr) => {
    const urlBase = randomUtil.getRandomArrayElt(config.waxEndpointsV2);
    const urlStr = '/v1/chain/get_block';
    const url = new URL(urlStr, urlBase);
    return newFetchPromise(url, 'post', bodyStr);
  };
  waxRpc.history_get_actions = async (t, skip, limit) => {
    return new Promise(async (resolve, reject) => {
      if (config.waxEndpointVersion == 'v1') {
        const urlBase = randomUtil.getRandomArrayElt(config.waxEndpointsV1);
        const req = `{"account_name": "${t}", "pos": "${e}", "offset": "${r}"}`;
        // console.log('history_get_actions', 'req', req);
        try {
          const url = `'${urlBase}/v1/history/get_actions'`;
          const res = await fetch(url, {
            method: 'post',
            body: req,
            headers: {'Content-Type': 'application/json'},
          });
          const json = await toJson(url, res);
          resolve(json);
        } catch (err) {
          reject(err);
        }
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
        try {
          const res = await fetch(url, {
            method: 'get',
            headers: {'Content-Type': 'application/json'},
          });
          const json = await toJson(urlStr, res);
          resolve(json);
        } catch (err) {
          reject(err);
        }
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

const isBadNonce = async (owner, nonce, nonceKind) => {
  if (config.overrideNonce) {
    return false;
  }
  if (owner == undefined) {
    throw Error('owner is a required field');
  }
  if (nonce == undefined) {
    throw Error('nonce is a required field');
  }
  if (nonceKind == undefined) {
    throw Error('nonceKind is a required field');
  }
  const nonceHash = getNonceHash(nonce);
  let lastNonceHashByOwnerMap;
  switch (nonceKind) {
    case 'wax':
      lastNonceHashByOwnerMap = waxLastNonceHashByOwnerMap;
      break;
    case 'cmc':
      lastNonceHashByOwnerMap = cmcLastNonceHashByOwnerMap;
      break;
    default:
      throw Error(`unknown nonceKind '${nonceKind}'`);
  }
  if (lastNonceHashByOwnerMap.has(owner)) {
    const lastNonceHash = lastNonceHashByOwnerMap.get(owner);
    // console.log('isBadNonce', 'cache', 'lastNonceHash', lastNonceHash, nonceHash);
    if (lastNonceHash == nonceHash) {
      return false;
    }
    lastNonceHashByOwnerMap.delete(owner);
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
        // const timestamp = ownerAction.timestamp;
        // console.log('isBadNonce', 'ownerAction.act', ownerAction.act);
        // console.log('isBadNonce', 'lastNonceHash', lastNonceHash);
        // console.log('isBadNonce', 'nonceHash', nonceHash);
        // console.log('isBadNonce', 'timestamp', timestamp);

        if (lastNonceHash == nonceHash) {
          allNoncesBad = false;
          lastNonceHashByOwnerMap.set(owner, lastNonceHash);
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
};

const getCachedNonceCount = () => {
  return waxLastNonceHashByOwnerMap.size + cmcLastNonceHashByOwnerMap.size;
};

const setCmcLastNonceHashByOwner = (owner, nonceHash) => {
  cmcLastNonceHashByOwnerMap.set(owner, nonceHash);
};

const getCmcLastNonceHashByOwner = (owner) => {
  if (cmcLastNonceHashByOwnerMap.has(owner)) {
    return cmcLastNonceHashByOwnerMap.get(owner);
  }
  return '';
};

export default {
  init,
  deactivate,
  isBadNonce,
  getWaxRpc,
  getCachedNonceCount,
  setCmcLastNonceHashByOwner,
  getCmcLastNonceHashByOwner,
  getNonceHash,
};
