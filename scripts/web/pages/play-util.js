'use strict';
// libraries
const fetch = require('node-fetch');
const {ExplorerApi} = require('atomicassets');
const fs = require('fs');
const request = require('request');

// modules
const randomUtil = require('../../util/random-util.js');
const dateUtil = require('../../util/date-util.js');
const seedUtil = require('../../util/seed-util.js');
const nonceUtil = require('../../util/nonce-util.js');
const assetUtil = require('../../util/asset-util.js');
const bananojsCacheUtil = require('../../util/bananojs-cache-util.js');

// constants

// variables

/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let waxApi;
const templates = [];
let ready = false;
const checkPendingSeeds = new Set();
/* eslint-enable no-unused-vars */

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

  bananojsCacheUtil.setBananodeApiUrl(config.bananodeApiUrl);

  ready = false;
  setTimeout(setWaxApiAndAddTemplates, 0);
};

const setWaxApiAndAddTemplates = async () => {
  try {
    waxApi = new ExplorerApi('https://wax.api.atomicassets.io', 'atomicassets', {fetch});
  } catch (error) {
    console.log('INTERIM setWaxApiAndAddTemplates', error.message);
    setTimeout(setWaxApiAndAddTemplates, 1000);
    return;
  }
  setTimeout(addAllTemplates, 0);
  await centralAccountReceivePending();
  setInterval(centralAccountReceivePending, config.centralWalletReceivePendingIntervalMs);
};

const deactivate = async () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  waxApi = undefined;
  templates.length = 0;
  ready = false;
  /* eslint-enable no-unused-vars */
};

const post = async (context, req, res) => {
  try {
    return await postWithoutCatch(context, req, res);
  } catch (error) {
    console.log('playUtil error', error.message);
    console.trace(error);
    const resp = {};
    resp.ready = false;
    resp.errorMessage = error.message;
    res.send(resp);
  }
};

const addAllTemplates = async () => {
  loggingUtil.log(dateUtil.getDate(), 'STARTED addAllTemplates');
  let page = 1;
  const max = 100;

  const addTemplates = async () => {
    loggingUtil.log(dateUtil.getDate(), 'STARTED addTemplates page', page);
    let lessThanMax = false;
    const worked = false;
    try {
      const pageTemplates = await waxApi.getTemplates({'collection_name': 'crptomonkeys'}, page, max);
      lessThanMax = templates.length < max;

      for (let pageTemplateIx = 0; pageTemplateIx < pageTemplates.length; pageTemplateIx++) {
        const pageTemplate = pageTemplates[pageTemplateIx];
        const pageTemplateData = {};
        pageTemplateData.template_id = pageTemplate.template_id;
        pageTemplateData.name = pageTemplate.immutable_data.name;
        pageTemplateData.img = pageTemplate.immutable_data.img;
        pageTemplateData.backimg = pageTemplate.immutable_data.backimg;
        templates.push(pageTemplateData);
      }

      if (lessThanMax) {
        loggingUtil.log(dateUtil.getDate(), 'SUCCESS addAllTemplates');
        setTimeout(cacheAllCardImages, 0);
      } else {
        loggingUtil.log(dateUtil.getDate(), 'SUCCESS addTemplates page' + page);
        page++;
        setTimeout(addTemplates, 1000);
      }
    } catch (error) {
      loggingUtil.log(dateUtil.getDate(), 'INTERIM addTemplates page' + page, error.message);
      setTimeout(addTemplates, 1000);
    }
  };
  addTemplates();
};

const cacheAllCardImages = async () => {
  loggingUtil.log(dateUtil.getDate(), 'STARTED cacheAllCardImages');

  const getFile = async (ipfs) => {
    const url = `https://wax.atomichub.io/preview?ipfs=${ipfs}&size=185&output=png&animated=false`;
    const fileName = `static-html/ipfs/${ipfs}.png`;
    if (!fs.existsSync(fileName)) {
      return new Promise((resolve, reject) => {
        request(url).pipe(fs.createWriteStream(fileName)).on('close', resolve);
      });
    }
  };

  for (let templateIx = 0; templateIx < templates.length; templateIx++) {
    loggingUtil.log(dateUtil.getDate(), 'INTERIM cacheAllCardImages', (templateIx+1), templates.length);
    const card = templates[templateIx];
    await getFile(card.img);
    await getFile(card.backimg);
  }
  ready = true;
  loggingUtil.log(dateUtil.getDate(), 'SUCCESS cacheAllCardImages');
};

const getTemplateCount = () => {
  return templates.length;
};

const getOwnedCards = async (owner) => {
  const assetOptions = {'collection_name': 'crptomonkeys', 'owner': owner};
  const assets = await waxApi.getAssets(assetOptions);
  return assets;
};

const ownerHasCard = async (owner, template_id) => {
  const assetOptions = {'collection_name': 'crptomonkeys', 'owner': owner, 'template_id': template_id};
  const assets = await waxApi.getAssets(assetOptions);
  return assets.length > 0;
};

const receivePending = async (representative, seed) => {
  const account = await bananojsCacheUtil.getBananoAccountFromSeed(seed, config.walletSeedIx);
  const pendingList = [];
  let noPending = false;
  while (!noPending) {
    const pending = await bananojsCacheUtil.getAccountsPending([account], config.maxPendingBananos, true);
    loggingUtil.log(dateUtil.getDate(), 'account', account, 'pending', pending.blocks[account]);
    // loggingUtil.log(dateUtil.getDate(), 'pending', pending);
    if (pending.error) {
      noPending = true;
    } else {
      const pendingBlocks = pending.blocks[account];
      const hashes = [...Object.keys(pendingBlocks)];
      if (hashes.length !== 0) {
        const hash = hashes[0];
        const response = await bananojsCacheUtil.receiveBananoDepositsForSeed(seed, config.walletSeedIx, representative, hash);
        pendingList.push(response);
      } else {
        noPending = true;
      }
    }
  }
  return pendingList;
};

const centralAccountReceivePending = async () => {
  try {
    loggingUtil.log(dateUtil.getDate(), 'STARTED centralAccountReceivePending');
    const centralAccount = await bananojsCacheUtil.getBananoAccountFromSeed(config.centralWalletSeed, config.walletSeedIx);
    const centralPendingList = await receivePending(centralAccount, config.centralWalletSeed);
    const seeds = [...checkPendingSeeds];
    seeds.push(config.houseWalletSeed);
    for (let seedIx = 0; seedIx < seeds.length; seedIx++) {
      const seed = seeds[seedIx];
      const pendingList = await receivePending(centralAccount, seed);
      loggingUtil.log(dateUtil.getDate(), 'pendingList');// , pendingList);
      checkPendingSeeds.delete(seed);
    }
    loggingUtil.log(dateUtil.getDate(), 'SUCCESS centralAccountReceivePending');// , centralPendingList);
  } catch (error) {
    loggingUtil.log(dateUtil.getDate(), 'FAILURE centralAccountReceivePending', error.message);
    console.trace(error);
  }
};

const postWithoutCatch = async (context, req, res) => {
  if (!ready) {
    loggingUtil.log(dateUtil.getDate(), 'not ready');
    const resp = {};
    resp.errorMessage = error.message;
    resp.ready = false;
    res.send(resp);
    return;
  }
  // loggingUtil.log(dateUtil.getDate(), 'STARTED play');
  const nonce = req.body.nonce;
  // loggingUtil.log(dateUtil.getDate(), 'nonce');// , owner);

  const houseAccount = await bananojsCacheUtil.getBananoAccountFromSeed(config.houseWalletSeed, config.walletSeedIx);

  const owner = req.body.owner;
  // loggingUtil.log(dateUtil.getDate(), 'owner');// , owner);

  const badNonce = await nonceUtil.isBadNonce(owner, nonce);
  if (badNonce) {
    const resp = {};
    resp.errorMessage = `Need to log in again, server side nonce hash has does not match blockchain nonce hash.`;
    resp.ready = false;
    res.send(resp);
    return;
  }

  const seed = seedUtil.getSeedFromOwner(owner);
  // loggingUtil.log(dateUtil.getDate(), 'seed');// , seed);
  const account = await bananojsCacheUtil.getBananoAccountFromSeed(seed, config.walletSeedIx);
  // loggingUtil.log(dateUtil.getDate(), 'account');// , account);
  checkPendingSeeds.add(seed);

  const resp = {};
  resp.ready = true;
  resp.account = account;
  resp.cards = [];
  resp.score = `No Current Bet, Press the 'Play' button to continue.`;
  resp.scoreError = false;
  resp.cardCount = 0;
  resp.templateCount = getTemplateCount();

  const updateBalances = async () => {
    const houseAccountInfo = await bananojsCacheUtil.getAccountInfo(houseAccount, true);
    // loggingUtil.log(dateUtil.getDate(), 'houseAccountInfo', houseAccountInfo);

    const accountInfo = await bananojsCacheUtil.getAccountInfo(account, true);
    // loggingUtil.log(dateUtil.getDate(), 'accountInfo', accountInfo);

    resp.accountInfo = accountInfo;
    resp.houseAccountInfo = houseAccountInfo;

    if (!resp.houseAccountInfo.error) {
      resp.houseBalanceParts = await bananojsCacheUtil.getBananoPartsFromRaw(houseAccountInfo.balance);
      resp.houseBalanceDescription = await bananojsCacheUtil.getBananoPartsDescription(resp.houseBalanceParts);
      resp.houseBalanceDecimal = await bananojsCacheUtil.getBananoPartsAsDecimal(resp.houseBalanceParts);
      resp.cacheHouseBalanceParts = await bananojsCacheUtil.getBananoPartsFromRaw(houseAccountInfo.cacheBalance);
      resp.cacheHouseBalanceDescription = await bananojsCacheUtil.getBananoPartsDescription(resp.cacheHouseBalanceParts);
    }
    if (!resp.accountInfo.error) {
      resp.balanceParts = await bananojsCacheUtil.getBananoPartsFromRaw(accountInfo.balance);
      resp.balanceDescription = await bananojsCacheUtil.getBananoPartsDescription(resp.balanceParts);
      resp.balanceDecimal = await bananojsCacheUtil.getBananoPartsAsDecimal(resp.balanceParts);
      resp.cacheBalanceParts = await bananojsCacheUtil.getBananoPartsFromRaw(resp.accountInfo.cacheBalance);
      resp.cacheBalanceDescription = await bananojsCacheUtil.getBananoPartsDescription(resp.cacheBalanceParts);
    }
  };
  await updateBalances();

  // loggingUtil.log(dateUtil.getDate(), 'STARTED countCards');
  const ownedCards = await getOwnedCards(owner);
  const frozenAssetByTemplateMap = {};
  const unfrozenAssetByTemplateMap = {};
  for (let ownedCardIx = 0; ownedCardIx < ownedCards.length; ownedCardIx++) {
    const ownedCard = ownedCards[ownedCardIx];
    const assetId = ownedCard.asset_id;
    assetUtil.thawAssetIfItIsTime(assetId);
    const template_id = ownedCard.template.template_id.toString();
    if (assetUtil.isAssetFrozen(assetId)) {
      if (frozenAssetByTemplateMap[template_id] === undefined) {
        frozenAssetByTemplateMap[template_id] = [];
      }
      frozenAssetByTemplateMap[template_id].push(assetId);
    } else {
      if (unfrozenAssetByTemplateMap[template_id] === undefined) {
        unfrozenAssetByTemplateMap[template_id] = [];
      }
      unfrozenAssetByTemplateMap[template_id].push(assetId);
    }
  }
  // loggingUtil.log(dateUtil.getDate(), 'ownedCards', ownedCards);
  // loggingUtil.log(dateUtil.getDate(), 'ownedCardTemplateSet', ownedCardTemplateSet);
  for (let templateIx = 0; templateIx < templates.length; templateIx++) {
    const card = templates[templateIx];
    const hasCard = unfrozenAssetByTemplateMap[card.template_id] !== undefined;
    // loggingUtil.log(dateUtil.getDate(), 'template_id', card.template_id, 'hasCard', hasCard);
    if (hasCard) {
      resp.cardCount++;
    }
    // if (await ownerHasCard(owner, card.template_id)) {
    // resp.cardCount++;
    // }
  }
  // loggingUtil.log(dateUtil.getDate(), 'SUCCESS countCards');

  const winningOneCardOdds = resp.cardCount/resp.templateCount;
  const winningOdds = winningOneCardOdds * winningOneCardOdds * winningOneCardOdds;
  resp.payoutOdds = parseInt((1./winningOdds).toFixed(0), 10);
  resp.payoutMultiplier = config.payoutMultiplier;

  let play = true;
  if (req.body.bet === undefined) {
    play = false;
  }
  if (resp.accountInfo.error) {
    play = false;
    resp.score = `Account '${account}' has zero balance. Please send at least one banano to the account.`;
    resp.scoreError = true;
  }
  if (resp.houseAccountInfo.error) {
    play = false;
    resp.score = `House Account '${houseAccount}' has zero balance. Please send at least one banano to the account.`;
    resp.scoreError = true;
  }

  if (play) {
    const banano = parseInt(resp.cacheBalanceParts[resp.cacheBalanceParts.majorName], 10);
    const houseBanano = parseInt(resp.cacheHouseBalanceParts[resp.cacheHouseBalanceParts.majorName], 10);
    const bet = parseInt(req.body.bet, 10);
    loggingUtil.log(dateUtil.getDate(), 'account', account, 'banano', banano, 'bet', bet, 'payout', resp.payoutOdds * bet, 'house balance', houseBanano, houseAccount);
    const winPayment = resp.payoutOdds * bet * resp.payoutMultiplier;
    if (!Number.isFinite(bet)) {
      resp.score = `Bad Bet '${bet}'`;
      resp.scoreError = true;
    } else if (bet > banano) {
      resp.score = `Low Balance. Bet '${bet}' greater than balance '${banano}'`;
      resp.scoreError = true;
    } else if (bet < 1) {
      resp.score = 'Min Bet 1 Ban';
      resp.scoreError = true;
    } else if (bet > 1000) {
      resp.score = 'Max Bet 1000 Ban';
      resp.scoreError = true;
    } else if (winPayment > houseBanano) {
      resp.score = `Low Central Balance. Bet '${bet}' times payout '${resp.payoutOdds}' times payout multiplier '${resp.payoutMultiplier}' = Win Payment ${winPayment} which is greater than house balance '${houseBanano}' of account '${houseAccount}'`;
      resp.scoreError = true;
    } else {
      resp.score = 'Won';
      resp.scoreError = false;
      const card1 = randomUtil.getRandomArrayElt(templates);
      const card2 = randomUtil.getRandomArrayElt(templates);
      const card3 = randomUtil.getRandomArrayElt(templates);
      const cards = [card1, card2, card3];
      // loggingUtil.log(dateUtil.getDate(), 'STARTED checkCards');
      for (let cardIx = 0; cardIx < cards.length; cardIx++) {
        const card = cards[cardIx];
        const cardData = {};
        const unfrozenAssets = unfrozenAssetByTemplateMap[card.template_id];
        const frozenAssets = frozenAssetByTemplateMap[card.template_id];

        cardData.name = card.name;
        cardData.ipfs = card.img;

        if (unfrozenAssets === undefined) {
          cardData.grayscale = true;
        } else if (unfrozenAssets.length == 0) {
          cardData.grayscale = true;
        } else {
          cardData.grayscale = false;
        }
        if (frozenAssets === undefined) {
          cardData.frozen = false;
        } else if (frozenAssets.length == 0) {
          cardData.frozen = false;
        } else {
          cardData.frozen = true;
        }

        // loggingUtil.log('INTERIM play', cardIx, 'card', card);
        if (cardData.grayscale || cardData.frozen) {
          resp.score = 'Lost';
        }
        resp.cards.push(cardData);
      }
      if (resp.score == 'Won') {
        for (let cardIx = 0; cardIx < cards.length; cardIx++) {
          const card = cards[cardIx];
          const assets = unfrozenAssetByTemplateMap[card.template_id];
          if (assets !== undefined) {
            assetUtil.freezeAsset(assets[0]);
          }
        }
      }
      // loggingUtil.log(dateUtil.getDate(), 'SUCCESS checkCards');
      const payout = async () => {
        try {
          if (resp.score == 'Won') {
            await bananojsCacheUtil.sendBananoWithdrawalFromSeed(config.houseWalletSeed, config.walletSeedIx, account, winPayment);
          } else {
            await bananojsCacheUtil.sendBananoWithdrawalFromSeed(seed, config.walletSeedIx, houseAccount, bet);
          }
          await updateBalances();
        } catch (error) {
          console.log('payout error', error.message);
          console.trace(error);
        }
      };
      await payout();
    }
  }

  // loggingUtil.log(dateUtil.getDate(), 'resp', resp);

  res.send(resp);
};

// exports
module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.post = post;
module.exports.getTemplateCount = getTemplateCount;
