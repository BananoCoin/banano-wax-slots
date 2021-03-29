'use strict';
// libraries
const http = require('http');
const request = require('request');
// const https = require('https');
// const cors = require('cors');
const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
// const crypto = require('crypto');

// modules
const dateUtil = require('../util/date-util.js');
const atomicassetsUtil = require('../util/atomicassets-util.js');
const bananojsCacheUtil = require('../util/bananojs-cache-util.js');
const nonceUtil = require('../util/nonce-util.js');
const seedUtil = require('../util/seed-util.js');
const webPagePlayUtil = require('./pages/play-util.js');
const webPageWithdrawUtil = require('./pages/withdraw-util.js');

// constants

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
};

const deactivate = async () => {
  config = undefined;
  loggingUtil = undefined;
  closeProgramFn = undefined;
  instance.close();
};

const initWebServer = async () => {
  const app = express();

  app.engine('.hbs', exphbs({extname: '.hbs',
    defaultLayout: 'main'}));
  app.set('view engine', '.hbs');

  app.use(express.static('static-html'));
  app.use(express.urlencoded({
    limit: '50mb',
    extended: true,
  }));
  app.use(bodyParser.json({
    limit: '50mb',
    extended: true,
  }));
  app.use((err, req, res, next) => {
    if (err) {
      loggingUtil.log(dateUtil.getDate(), 'error', err.message, err.body);
      res.send('');
    } else {
      next();
    }
  });

  app.use(cookieParser(config.cookieSecret));

  app.get('/', async (req, res) => {
    const data = {};
    data.templateCount = atomicassetsUtil.getTemplateCount();
    data.burnAccount = config.burnAccount;
    data.hcaptchaEnabled = config.hcaptcha.enabled;
    data.hcaptchaSiteKey = config.hcaptcha.sitekey;

    res.render('slots', data);
  });

  app.post('/play', async (req, res) => {
    const context = {};
    await webPagePlayUtil.post(context, req, res);
  });

  app.post('/withdraw', async (req, res) => {
    const context = {};
    await webPageWithdrawUtil.post(context, req, res);
  });

  app.post('/hcaptcha', async (req, res) => {
    const context = {};
    if (req.body['h-captcha-response'] === undefined) {
      const resp = {};
      resp.message = 'no h-captcha-response';
      resp.success = false;
      res.send(resp);
    }
    if (req.body.nonce === undefined) {
      const resp = {};
      resp.message = 'no nonce';
      resp.success = false;
      res.send(resp);
    }
    if (req.body.owner === undefined) {
      const resp = {};
      resp.message = 'no owner';
      resp.success = false;
      res.send(resp);
    }
    const nonce = req.body.nonce;
    const owner = req.body.owner;
    const badNonce = await nonceUtil.isBadNonce(owner, nonce);
    if (badNonce) {
      const resp = {};
      resp.errorMessage = `Need to log in again, server side nonce hash has does not match blockchain nonce hash.`;
      resp.ready = false;
      res.send(resp);
      return;
    }

    const ip = getIp(req);
    const response = await getCaptchaResponse(config, req, ip);
    console.log(dateUtil.getDate(), 'hcaptcha', response);
    const responseJson = JSON.parse(response);
    if (!responseJson.success) {
      const resp = {};
      resp.message = 'hcaptcha failed';
      resp.success = false;
      res.send(resp);
      return;
    }
    const payoutInformation = await atomicassetsUtil.getPayoutInformation(owner);
    const seed = seedUtil.getSeedFromOwner(owner);
    const account = await bananojsCacheUtil.getBananoAccountFromSeed(seed, config.walletSeedIx);
    const captchaAmount = config.hcaptcha.bananos;
    loggingUtil.log(dateUtil.getDate(), 'hcaptcha', account, captchaAmount);
    await bananojsCacheUtil.sendBananoWithdrawalFromSeed(config.houseWalletSeed, config.walletSeedIx, account, captchaAmount);
    const resp = {};
    resp.message = '';
    resp.success = true;
    res.send(resp);
  });


  app.get('/favicon.ico', async (req, res) => {
    res.redirect(302, '/favicon-16x16.png');
  });

  app.post('/favicon.ico', async (req, res) => {
    res.redirect(302, '/favicon.ico');
  });

  app.use((req, res, next) => {
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
  // console.log('ip', ip);
  return ip;
};

const getCaptchaResponse = async (config, req, ip) => {
  return new Promise((resolve) => {
    // console.log('config', config);
    /*
      Send a http POST to  with the following parameters:
    secret
        Your verification key
    token
        The user's answer from the form field h-captcha-response
    remoteip
        The user's IP address
      */
    const token = req.body['h-captcha-response'];
    // const body = `{ 'secret': ${config.secretKey}, 'response': ${token} }`;

    let body = '';
    body += `secret=${config.hcaptcha.secret}`;
    body += '&';
    body += `response=${token}`;
    body += '&';
    body += `remoteip=${ip}`;

    // console.log('submitting', body);

    request({
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        // 'content-type': 'application/json',
      },
      uri: ' https://hcaptcha.com/siteverify',
      body: body,
      method: 'POST',
      timeout: 30000,
    }, (err, httpResponse, response) => {
      // console.log('sendRequest body', body);
      // console.log('sendRequest err', err);
      // console.log('sendRequest httpResponse', httpResponse);
      // if (response.includes('credit')) {
      // console.log('sendRequest', ip, response);
      // }
      resolve(response);
    });
  });
};

// exports
module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.setCloseProgramFunction = setCloseProgramFunction;
