'use strict';
// libraries
const http = require('http');
const express = require('express');
const exphbs = require('express-handlebars');
const cookieParser = require('cookie-parser');
const fetch = require('node-fetch');

// modules
const dateUtil = require('../util/date-util.js');
const atomicassetsUtil = require('../util/atomicassets-util.js');
const nonceUtil = require('../util/nonce-util.js');
const webPagePlayUtil = require('./pages/play-util.js');
const webPageWithdrawUtil = require('./pages/withdraw-util.js');
const randomUtil = require('../util/random-util.js');
const timedCacheUtil = require('../util/timed-cache-util.js');
const sanitizeBodyUtil = require('../util/sanitize-body-util.js');

// constants
const version = require('../../package.json').version;
const historyGetActionsCacheMap = new Map();

// variables
let config;
let loggingUtil;
let instance;
let closeProgramFn;


// functions
const init = async (_config, _loggingUtil) => {
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

  await initWebServer();

  await refreshWaxEndpointList();
};

const toJson = async (url, res) => {
  if (res.status !== 200) {
    throw Error(`url:'${url}' status:'${res.status}' statusText:'${res.statusText}'`);
  }
  const headerNm = 'access-control-allow-origin';
  if (res.headers.has(headerNm)) {
    const originControl = res.headers.get(headerNm);
    if (originControl.length !== 1) {
      throw Error(`url:'${url}' cors:'${JSON.stringify(originControl)}'`);
    }
    if (originControl[0] !== '*') {
      throw Error(`url:'${url}' cors:'${JSON.stringify(originControl)}'`);
    }
    // console.log(`cors`, originControl);
  }
  // console.log(`res.headers`, res.headers);
  const text = await res.text();
  // console.log('text',text)
  return JSON.parse(text);
};


const refreshAtomicAssetsEndpointList = async () => {
  loggingUtil.log(dateUtil.getDate(), 'refreshAtomicAssetsEndpointList', 'STARTING', 'count', config.atomicAssetsEndpointsV2.length);
  try {
    const url = config.atomicAssetsEndpointsV2ListUrl;
    const res = await fetch(url, {
      method: 'GET',
      headers: {'Content-Type': 'application/json'},
    });
    const json = await toJson(url, res);
    const newEndpoints = [];
    for (let ix = 0; ix < json.length; ix++) {
      const elt = json[ix];
      const eltWeight = parseInt(elt.weight, 10);
      if (eltWeight >= config.waxEndpointV2MinWeight) {
        try {
          const api = atomicassetsUtil.getWaxApi(elt.node_url);
          const res = await api.getConfig();
          let success = false;
          if (res.success) {
            newEndpoints.push(elt.node_url);
            success = true;
          }
          loggingUtil.log(dateUtil.getDate(), 'refreshAtomicAssetsEndpointList', ix, 'of', json.length, 'INTERIM', eltWeight, 'success', success);
        } catch (error) {
          loggingUtil.log(dateUtil.getDate(), 'refreshAtomicAssetsEndpointList', ix, 'of', json.length, 'INTERIM', eltWeight, 'elt.node_url', elt.node_url, 'error', error.message);
        }
      } else {
        loggingUtil.log(dateUtil.getDate(), 'refreshAtomicAssetsEndpointList', ix, 'of', json.length, 'SKIPPED', eltWeight);
      }
    }
    loggingUtil.log(dateUtil.getDate(), 'refreshAtomicAssetsEndpointList', 'INTERIM ', 'count', newEndpoints.length, 'distinct', distinct(newEndpoints).length);
    if (newEndpoints.length > 0) {
      config.atomicAssetsEndpointsV2.length = 0;
      newEndpoints.forEach((url) => {
        config.atomicAssetsEndpointsV2.push(url);
      });
    }

    loggingUtil.log(dateUtil.getDate(), 'refreshAtomicAssetsEndpointList', 'FINISHED', 'count', config.atomicAssetsEndpointsV2.length, 'distinct', distinct(config.atomicAssetsEndpointsV2).length);
  } catch (error) {
    loggingUtil.trace(error);
    loggingUtil.log(dateUtil.getDate(), 'refreshAtomicAssetsEndpointList', 'FAILURE', 'error', error.message);
  }
};

const refreshWaxEndpointList = async () => {
  await refreshAtomicAssetsEndpointList();
  loggingUtil.log(dateUtil.getDate(), 'refreshWaxEndpointList', 'STARTING', 'count', config.waxEndpointsV2.length);
  try {
    const url = config.waxEndpointV2ListUrl;
    const res = await fetch(url, {
      method: 'GET',
      headers: {'Content-Type': 'application/json'},
    });
    const json = await toJson(url, res);
    const newEndpoints = [];
    for (let ix = 0; ix < json.length; ix++) {
      const elt = json[ix];
      const eltWeight = parseInt(elt.weight, 10);
      if (eltWeight >= config.waxEndpointV2MinWeight) {
        const href = `${elt.node_url}/v2/history/get_actions?act.name=requestrand&account=${config.burnAccount}&limit=1`;
        const res = await fetch(href, {
          method: 'get',
          headers: {'Content-Type': 'application/json'},
        });

        try {
          const getActionsResp = await toJson(elt.node_url, res);
          if (getActionsResp.actions !== undefined) {
            if (getActionsResp.actions.length > 0) {
              for (let ix = 0; ix < eltWeight; ix++) {
                newEndpoints.push(elt.node_url);
              }
            }
          }
          loggingUtil.debug(dateUtil.getDate(), 'refreshWaxEndpointList', ix, json.length, 'INTERIM ', eltWeight, 'success');
        } catch (error) {
          loggingUtil.debug(dateUtil.getDate(), 'refreshWaxEndpointList', ix, json.length, 'INTERIM ', eltWeight, 'error', error.message);
        }
      }
    }
    loggingUtil.debug(dateUtil.getDate(), 'refreshWaxEndpointList', 'INTERIM ', 'count', newEndpoints.length, 'distinct', distinct(newEndpoints).length);
    if (newEndpoints.length > 0) {
      config.waxEndpointsV2.length = 0;
      newEndpoints.forEach((url) => {
        config.waxEndpointsV2.push(url);
      });
    }

    loggingUtil.log(dateUtil.getDate(), 'refreshWaxEndpointList', 'FINISHED', 'count', config.waxEndpointsV2.length, 'distinct', distinct(config.waxEndpointsV2).length);
  } catch (error) {
    loggingUtil.trace(error);
    loggingUtil.log(dateUtil.getDate(), 'refreshWaxEndpointList', 'FAILURE', 'error', error.message);
  }
  setTimeout(refreshWaxEndpointList, config.waxEndpointV2RefreshMs);
};

const deactivate = async () => {
  config = undefined;
  loggingUtil = undefined;
  closeProgramFn = undefined;
  instance.close();
};

const initWebServer = async () => {
  const app = express();

  app.engine('.hbs', exphbs.engine({extname: '.hbs',
    defaultLayout: 'main'}));
  app.set('view engine', '.hbs');

  app.use(express.static('static-html'));
  app.use(express.urlencoded({
    limit: '50mb',
    extended: true,
  }));
  app.use(express.json({
    limit: '50mb',
    extended: true,
  }));
  app.use((err, req, res, next) => {
    if (err) {
      loggingUtil.log(dateUtil.getDate(), 'error', req.url, err.message, err.body);
      res.send('');
    } else {
      next();
    }
  });

  app.use(cookieParser(config.cookieSecret));

  app.get('/', async (req, res) => {
    const data = {};
    data.accountSeedLinkEnabled = config.accountSeedLinkEnabled;
    data.templateCount = atomicassetsUtil.getTemplateCount();
    data.burnAccount = config.burnAccount;
    data.hcaptchaEnabled = config.hcaptcha.enabled;
    data.blackMonkeyEnabled = config.blackMonkeyCaptcha.enabled;
    data.anyCaptchaEnabled = data.hcaptchaEnabled || data.blackMonkeyEnabled;
    data.hcaptchaSiteKey = config.hcaptcha.sitekey;
    data.version = version;
    data.overrideNonce = config.overrideNonce;
    data.waxEndpointVersion = config.waxEndpointVersion;
    data.authUrl = config.cryptomonkeysConnect.auth_url;
    data.clientId = config.cryptomonkeysConnect.client_id;

    if (config.waxEndpointVersion == 'v2proxy') {
      data.waxEndpoint = '';
      data.waxEndpoints = JSON.stringify(distinct(config.waxEndpointsV2));
    }
    if (config.waxEndpointVersion == 'v2') {
      data.waxEndpoint = randomUtil.getRandomArrayElt(config.waxEndpointsV2);
      data.waxEndpoints = JSON.stringify(distinct(config.waxEndpointsV2));
    }
    if (config.waxEndpointVersion == 'v1') {
      data.waxEndpoint = randomUtil.getRandomArrayElt(config.waxEndpointsV1);
      data.waxEndpoints = JSON.stringify(config.waxEndpointsV1);
    }
    // console.log('/', data);

    res.render('slots', data);
  });

  app.post('/play', async (req, res) => {
    try {
      sanitizeBodyUtil.sanitizeBody(req.body);
    } catch (error) /* istanbul ignore next */ {
      const resp = {};
      resp.error = error.message;
      res.send(resp);
      return;
    }
    const context = {};
    await webPagePlayUtil.post(context, req, res);
  });

  app.post('/withdraw', async (req, res) => {
    try {
      sanitizeBodyUtil.sanitizeBody(req.body);
    } catch (error) /* istanbul ignore next */ {
      const resp = {};
      resp.error = error.message;
      res.send(resp);
      return;
    }
    const context = {};
    await webPageWithdrawUtil.post(context, req, res);
  });

  app.get('/v2/history/get_actions', async (req, res) => {
    const account = req.query.account;
    const skip = req.query.skip;
    const limit = req.query.limit;
    loggingUtil.log(dateUtil.getDate(), '/v2/history/get_actions', account, skip, limit);

    const historyGetActionsCallback = async () => {
      return await nonceUtil.getWaxRpc().history_get_actions(account, skip, limit);
    };

    try {
      const resp = await timedCacheUtil.getUsingNamedCache('History Get Actions',
          historyGetActionsCacheMap, account,
          config.historyGetActionsTimeMs, historyGetActionsCallback);
      res.send(resp);
    } catch (error) {
      res.send({});
    }
  });

  app.post('/v1/chain/get_info', async (req, res) => {
    loggingUtil.log(dateUtil.getDate(), 'post', 'v1/chain/get_info');
    const resp = await nonceUtil.getWaxRpc().chain_get_info();
    res.send(resp);
  });

  app.post('/v1/chain/get_block', async (req, res) => {
    let bodyStr = '';
    req.on('data', (chunk) => {
      bodyStr += chunk.toString();
    });
    req.on('end', async () => {
      loggingUtil.log(dateUtil.getDate(), 'post', 'v1/chain/get_block', req.method, req.url, req.body, bodyStr);
      const resp = await nonceUtil.getWaxRpc().chain_get_block(bodyStr);
      res.send(resp);
    });
  });

  app.post('/v1/chain/get_raw_code_and_abi', async (req, res) => {
    let bodyStr = '';
    req.on('data', (chunk) => {
      bodyStr += chunk.toString();
    });
    req.on('end', async () => {
      loggingUtil.log(dateUtil.getDate(), 'post', 'v1/chain/get_raw_code_and_abi', bodyStr);
      const resp = await nonceUtil.getWaxRpc().chain_get_raw_code_and_abi(bodyStr);
      res.send(resp);
    });
  });

  app.post('/v1/chain/get_required_keys', async (req, res) => {
    let bodyStr = '';
    req.on('data', (chunk) => {
      bodyStr += chunk.toString();
    });
    req.on('end', async () => {
      loggingUtil.log(dateUtil.getDate(), 'post', 'v1/chain/get_required_keys', bodyStr);
      const resp = await nonceUtil.getWaxRpc().chain_get_required_keys(bodyStr);
      res.send(resp);
    });
  });

  app.post('/v1/chain/push_transaction', async (req, res) => {
    let bodyStr = '';
    req.on('data', (chunk) => {
      bodyStr += chunk.toString();
    });
    req.on('end', async () => {
      loggingUtil.log(dateUtil.getDate(), 'post', 'v1/chain/push_transaction', bodyStr);
      const resp = await nonceUtil.getWaxRpc().chain_push_transaction(bodyStr);
      res.send(resp);
    });
  });

  app.get('/cmc_nonce_hash', async (req, res) => {
    try {
      sanitizeBodyUtil.sanitizeBody(req.body);
    } catch (error) /* istanbul ignore next */ {
      const resp = {};
      resp.error = error.message;
      res.send(resp);
      return;
    }
    loggingUtil.debug(dateUtil.getDate(), 'cmc_nonce_hash', req.method, req.url, req.query, req.body);
    const owner = req.query.owner;
    const nonceHash = nonceUtil.getCmcLastNonceHashByOwner(owner);
    res.type('text/plain;charset=UTF-8');
    res.send(nonceHash);
  });

  app.get('/oauth/monkeyconnect/callback', async (req, res) => {
    try {
      sanitizeBodyUtil.sanitizeBody(req.query);
    } catch (error) /* istanbul ignore next */ {
      const resp = {};
      resp.error = error.message;
      res.send(resp);
      return;
    }
    loggingUtil.debug(dateUtil.getDate(), 'callback', req.method, req.url, req.query, req.body);
    const code = req.query.code;
    const state = req.query.state;
    loggingUtil.debug(dateUtil.getDate(), 'callback', 'code', code);
    loggingUtil.debug(dateUtil.getDate(), 'callback', 'state', state);

    const tokenUrl = config.cryptomonkeysConnect.token_url;
    let tokenBodyForm = '';
    tokenBodyForm += 'client_id=' + config.cryptomonkeysConnect.client_id;
    tokenBodyForm += '&client_secret=' + config.cryptomonkeysConnect.client_secret;
    tokenBodyForm += '&grant_type=authorization_code';
    tokenBodyForm += '&code=' + code;
    if (config.cryptomonkeysConnect.redirect_uri !== '') {
      tokenBodyForm += '&redirect_uri=' + config.cryptomonkeysConnect.redirect_uri;
    }
    loggingUtil.debug('tokenUrl', tokenUrl);
    loggingUtil.debug('tokenBodyForm', tokenBodyForm);
    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenBodyForm,
    });

    if (tokenRes.status !== 200) {
      const tokenResponseText = await tokenRes.text();
      loggingUtil.log(dateUtil.getDate(), 'callback', 'code', code);
      loggingUtil.log(dateUtil.getDate(), 'callback', 'state', state);
      loggingUtil.log('tokenUrl', tokenUrl);
      loggingUtil.log('tokenBodyForm', tokenBodyForm);
      loggingUtil.log('token', 'FAILED');
      loggingUtil.log('tokenStatus', tokenRes.status);
      loggingUtil.log('tokenStatusText', tokenRes.statusText);
      // loggingUtil.log('tokenRes', tokenRes);
      loggingUtil.log('tokenUrl', tokenUrl);
      loggingUtil.log('tokenBodyForm', tokenBodyForm);
      loggingUtil.log('tokenResponseText', tokenResponseText);
      res.redirect(302, '/');
      return;
    }
    const tokenRespJson = await toJson(tokenUrl, tokenRes);
    loggingUtil.debug('tokenRespJson', tokenRespJson);

    const usernameUrl = config.cryptomonkeysConnect.username_api_url;
    const usernameRes = await fetch(usernameUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + tokenRespJson.access_token,
      },
    });
    const usernameRespJson = await toJson(usernameUrl, usernameRes);
    loggingUtil.debug(dateUtil.getDate(), 'callback', 'usernameRespJson', usernameRespJson);

    await atomicassetsUtil.saveWalletsForOwner(usernameRespJson.user, usernameRespJson.wallets);

    let redirectUrl = '/';
    if (usernameRespJson.success) {
      const owner = usernameRespJson.user;
      const noncehash = nonceUtil.getNonceHash(state);
      nonceUtil.setCmcLastNonceHashByOwner(owner, noncehash);
      redirectUrl = '/?owner=' + owner;
    }
    // loggingUtil.log(dateUtil.getDate(), 'callback', 'nonce', nonce);
    res.redirect(302, redirectUrl);
  });

  app.get('/favicon.ico', async (req, res) => {
    res.redirect(302, '/favicon-16x16.png');
  });

  app.post('/favicon.ico', async (req, res) => {
    res.redirect(302, '/favicon.ico');
  });

  app.use((req, res, next) => {
    loggingUtil.log(dateUtil.getDate(), '?', req.method, req.url, req.query, req.body);
    res.status(404);
    res.type('text/plain;charset=UTF-8').send('');
  });

  const server = http.createServer(app);

  instance = server.listen(config.web.port, (err) => {
    if (err) {
      loggingUtil.error(dateUtil.getDate(), 'wax-slots ERROR', err);
    }
    loggingUtil.log(dateUtil.getDate(), 'wax-slots listening on PORT', config.web.port);
  });

  const io = require('socket.io')(server);
  io.on('connection', (socket) => {
    socket.on('npmStop', () => {
      socket.emit('npmStopAck');
      socket.disconnect(true);
      closeProgramFn();
    });
  });
};

const setCloseProgramFunction = (fn) => {
  closeProgramFn = fn;
};

// const getIp = (req) => {
//   let ip;
//   if (req.headers['x-forwarded-for'] !== undefined) {
//     ip = req.headers['x-forwarded-for'];
//   } else if (req.connection.remoteAddress == '::ffff:127.0.0.1') {
//     ip = '::ffff:127.0.0.1';
//   } else if (req.connection.remoteAddress == '::1') {
//     ip = '::ffff:127.0.0.1';
//   } else {
//     ip = req.connection.remoteAddress;
//   }
//   // console.log('ip', ip);
//   return ip;
// };

// const getCaptchaResponse = async (config, req, ip) => {
//   return new Promise((resolve) => {
//     // console.log('config', config);
//     /*
//       Send a http POST to  with the following parameters:
//     secret
//         Your verification key
//     token
//         The user's answer from the form field h-captcha-response
//     remoteip
//         The user's IP address
//       */
//     const token = req.body['h-captcha-response'];
//     // const body = `{ 'secret': ${config.secretKey}, 'response': ${token} }`;
//
//     let body = '';
//     body += `secret=${config.hcaptcha.secret}`;
//     body += '&';
//     body += `response=${token}`;
//     body += '&';
//     body += `remoteip=${ip}`;
//
//     // console.log('submitting', body);
//
//     request({
//       headers: {
//         'content-type': 'application/x-www-form-urlencoded',
//         // 'content-type': 'application/json',
//       },
//       uri: ' https://hcaptcha.com/siteverify',
//       body: body,
//       method: 'POST',
//       timeout: 30000,
//     }, (err, httpResponse, response) => {
//       // console.log('sendRequest body', body);
//       // console.log('sendRequest err', err);
//       // console.log('sendRequest httpResponse', httpResponse);
//       // if (response.includes('credit')) {
//       // console.log('sendRequest', ip, response);
//       // }
//       resolve(response);
//     });
//   });
// };

// const verifyOwnerAndNonce = async (req) => {
//   if (req.body.nonce === undefined) {
//     const resp = {};
//     resp.message = 'no nonce';
//     resp.success = false;
//     return resp;
//   }
//   if (req.body.owner === undefined) {
//     const resp = {};
//     resp.message = 'no owner';
//     resp.success = false;
//     return resp;
//   }
//   if (req.body.nonce_kind === undefined) {
//     const resp = {};
//     resp.message = 'no nonce_kind';
//     resp.success = false;
//     return resp;
//   }
//   const nonce = req.body.nonce;
//   const owner = req.body.owner;
//   const nonceKind = req.body.nonce_kind;
//   const badNonce = await nonceUtil.isBadNonce(owner, nonce, nonceKind);
//   if (badNonce) {
//     const resp = {};
//     resp.errorMessage = `Nonce mismatch, log in again.`;
//     resp.ready = false;
//     return resp;
//   }
// };

const distinct = (array) => {
  return [...new Set(array)];
};

// exports
module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.setCloseProgramFunction = setCloseProgramFunction;
