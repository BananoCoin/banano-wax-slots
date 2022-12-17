'use strict';
// libraries
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const request = require('request');
const sharp = require('sharp');

// modules
const assetUtil = require('./asset-util.js');
const dateUtil = require('./date-util.js');
const timedCacheUtil = require('./timed-cache-util.js');
const awaitSemaphore = require('await-semaphore');
const randomUtil = require('./random-util.js');
const fetchWithTimeoutUtil = require('./fetch-with-timeout-util.js');

// constants

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
const templates = [];
let ready = false;
let mutex;
let ExplorerApi;
/* eslint-enable no-unused-vars */

const ownerAssetCacheMap = new Map();
const excludedTemplateSet = new Set();
const includedSchemaSet = new Set();

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

  ready = false;

  mutex = new awaitSemaphore.Mutex();

  if (!fs.existsSync(config.ownerWalletDataDir)) {
    fs.mkdirSync(config.ownerWalletDataDir, {recursive: true});
  }

  ExplorerApi = class ExplorerApi {
    /**
     * constructor
     * @param {string} endpoint the endpoint
     * @param {string} namespace the namespace
     * @param {string} args the args
     * @return {undefined} returns nothing.
     */
    constructor(endpoint, namespace, args) {
      this.endpoint = endpoint;
      this.namespace = namespace;
      this.fetch = args.fetch;
    };
    /**
     * gets the config
     * @return {Object} returns json.
     */
    async getConfig() {
      const url = `${this.endpoint}/${this.namespace}/v1/config`;
      const response = await this.fetch(url);
      return await response.json();
    }
    /**
     * gets the assets
     * @param {string} options the options
     * @param {string} page the page
     * @param {string} limit the limit
     * @return {Array} returns an array of data.
     */
    async getAssets(options = {}, page = 1, limit = 100) {
      let url = `${this.endpoint}/${this.namespace}/v1/assets?page=${page}&limit=${limit}`;
      Object.keys(options).forEach((key) => {
        const value = options[key];
        url += `&${key}=${value}`;
      });
      const response = await this.fetch(url);
      const json = await response.json();
      return json.data;
    }
    /**
     * gets the templates
     * @param {string} options the options
     * @param {string} page the page
     * @param {string} limit the limit
     * @return {Array} returns an array of data.
     */
    async getTemplates(options = {}, page = 1, limit = 100) {
      let url = `${this.endpoint}/${this.namespace}/v1/templates?page=${page}&limit=${limit}`;
      Object.keys(options).forEach((key) => {
        const value = options[key];
        url += `&${key}=${value}`;
      });
      const response = await this.fetch(url);
      const json = await response.json();
      return json.data;
    };
  };
  // setTimeout(setWaxApiAndAddTemplates, 0);
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  mutex = undefined;
  /* eslint-enable no-unused-vars */
  templates.length = 0;
  ready = false;
};

const getWaxApiUrl = () => {
  return randomUtil.getRandomArrayElt(config.atomicAssetsEndpointsV2);
};

const getWaxApi = (url) => {
  try {
    const waxApi = new ExplorerApi(url, 'atomicassets', {fetch: fetchWithTimeoutUtil.fetchWithTimeout});
    return waxApi;
  } catch (error) {
    loggingUtil.log('FAILURE getWaxApi', url, error.message);
    return;
  }
};

const setWaxApiAndAddTemplates = async () => {
  const url = getWaxApiUrl();
  try {
    const waxApi = getWaxApi(url);
    await addAllTemplates(waxApi);
  } catch (error) {
    // console.trace(error);
    loggingUtil.log('INTERIM setWaxApiAndAddTemplates', url, error.message);
    setTimeout(setWaxApiAndAddTemplates, 1000);
    return;
  }
};

const addAllTemplates = async (waxApi) => {
  loggingUtil.log(dateUtil.getDate(), 'STARTED addAllTemplates');

  config.excludedTemplates.forEach((templateId) => {
    excludedTemplateSet.add(templateId);
  });

  config.includedSchemas.forEach((schemaId) => {
    includedSchemaSet.add(schemaId);
  });

  let page = 1;
  const max = config.maxTemplatesPerPage;

  const addTemplates = async () => {
    loggingUtil.log(dateUtil.getDate(), 'STARTED addTemplates page', page);
    let lessThanMax = false;
    try {
      const pageTemplates = await waxApi.getTemplates({'collection_name': 'crptomonkeys', 'schema_name': 'crptomonkeys'}, page, max);
      lessThanMax = pageTemplates.length < max;
      loggingUtil.log(dateUtil.getDate(), 'INTERIM addTemplates page', page, pageTemplates.length, max);

      for (let pageTemplateIx = 0; pageTemplateIx < pageTemplates.length; pageTemplateIx++) {
        const pageTemplate = pageTemplates[pageTemplateIx];
        if (!excludedTemplateSet.has(pageTemplate.template_id)) {
          if (includedSchemaSet.has(pageTemplate.schema.schema_name)) {
            // loggingUtil.log(dateUtil.getDate(), 'STARTED addTemplates pageTemplate', pageTemplate);
            const pageTemplateData = {};
            pageTemplateData.template_id = pageTemplate.template_id;
            pageTemplateData.schema_name = pageTemplate.schema.schema_name;
            pageTemplateData.name = pageTemplate.immutable_data.name;
            pageTemplateData.img = pageTemplate.immutable_data.img;
            pageTemplateData.backimg = pageTemplate.immutable_data.backimg;
            pageTemplateData.issued_supply = parseInt(pageTemplate.issued_supply, 10);
            pageTemplateData.max_supply = parseInt(pageTemplate.max_supply, 10);
            pageTemplateData.rarity = pageTemplate.immutable_data.rarity.toLowerCase();
            // loggingUtil.log(dateUtil.getDate(), 'SUCCESS addTemplates pageTemplateData', pageTemplateData);
            templates.push(pageTemplateData);
          }
        }
      }

      if (lessThanMax) {
        loggingUtil.log(dateUtil.getDate(), 'SUCCESS addAllTemplates');
        setTimeout(cacheAllCardImages, 0);
      } else {
        loggingUtil.log(dateUtil.getDate(), 'SUCCESS addTemplates page', page);
        page++;
        setTimeout(addTemplates, 1000);
      }
    } catch (error) {
      loggingUtil.log(dateUtil.getDate(), 'INTERIM addTemplates page', page, error.message);
      setTimeout(addTemplates, 1000);
    }
  };
  addTemplates();
};


const cacheAllCardImages = async () => {
  loggingUtil.log(dateUtil.getDate(), 'STARTED cacheAllCardImages');
  const getFile = async (ipfs) => {
    const url = `https://ipfs.io/ipfs/${ipfs}`;
    const tempFileName = `static-html/ipfs/${ipfs}-temp.webp`;
    const fileName = `static-html/ipfs/${ipfs}.webp`;
    if (!fs.existsSync(fileName)) {
      return new Promise((resolve, reject) => {
        const shrink = () => {
          loggingUtil.log(dateUtil.getDate(), 'INTERIM cacheAllCardImages', 'shrink', fileName);
          sharp(tempFileName)
              .resize(265, 370)
              .toFile(fileName, (err, info) => {
                if (err != null) {
                  loggingUtil.log(dateUtil.getDate(), 'INTERIM cacheAllCardImages', 'err', err);
                }
                // loggingUtil.log(dateUtil.getDate(), 'INTERIM cacheAllCardImages', 'info', info);
                // fs.unlinkSync(tempFileName);
                resolve();
              });
        };
        request(url).pipe(fs.createWriteStream(tempFileName)).on('close', shrink);
      });
    }
  };

  for (let templateIx = 0; templateIx < templates.length; templateIx++) {
    loggingUtil.log(dateUtil.getDate(), 'INTERIM cacheAllCardImages', (templateIx+1), templates.length);
    const card = templates[templateIx];
    await getFile(card.img);

    // await getFile(card.backimg);
  }
  ready = true;
  loggingUtil.log(dateUtil.getDate(), 'SUCCESS cacheAllCardImages');
  setTimeout(thawAllAssetsIfItIsTime, 0);
};

const getTemplateCount = () => {
  return templates.length;
};

const getAssetOptions = (owner) => {
  return {'collection_name': 'crptomonkeys', 'schema_name': 'crptomonkeys', 'owner': owner};
};

const hasOwnedCards = async (owner) => {
  const wallets = await loadWalletsForOwner(owner);
  for (let ix = 0; ix < wallets.length; ix++) {
    const url = getWaxApiUrl();
    const waxApi = getWaxApi(url);
    const wallet = wallets[ix];
    const assetOptions = getAssetOptions(wallet);
    const pageAssets = await waxApi.getAssets(assetOptions, 1, 1);
    if (pageAssets.length > 0) {
      return true;
    }
  }
  return false;
};

const isOwnerEligibleForGiveaway = async (owner) => {
  // is owner frozen card count over the config.minGiveawayBetCount
  // isOwnerFrozenCardCountOverMinGiveawayBetCount
  const ownedCards = await getOwnedCards(owner);
  let frozenCount = 0;
  for (let ownedCardIx = 0; ownedCardIx < ownedCards.length; ownedCardIx++) {
    const ownedCard = ownedCards[ownedCardIx];
    const assetId = ownedCard.asset_id;
    const isAssetFrozenFlag = await assetUtil.isAssetFrozen(assetId);
    if (isAssetFrozenFlag) {
      frozenCount++;
    }
    if (frozenCount >= config.minGiveawayBetCount) {
      // loggingUtil.log(dateUtil.getDate(), 'isOwnerEligibleForGiveaway', true, frozenCount, '>=', config.minGiveawayBetCount);
      return true;
    }
  }
  return false;
};

const getTotalActiveCardCount = () => {
  return timedCacheUtil.getCacheSize(ownerAssetCacheMap);
};

const getActiveCardHistogram = () => {
  return timedCacheUtil.getCacheHistogram(ownerAssetCacheMap);
};

const getOwnedCards = async (owner) => {
  const getOwnedCardsCallback = () => {
    return getOwnedCardsToCache(owner);
  };
  return await timedCacheUtil.getUsingNamedCache('Owned Cards', ownerAssetCacheMap, owner,
      config.assetCacheTimeMs, getOwnedCardsCallback);
};

const getOwnedCardsToCache = async (owner) => {
  const allAssets = [];
  const wallets = await loadWalletsForOwner(owner);
  for (let ix = 0; ix < wallets.length; ix++) {
    const wallet = wallets[ix];
    const assetOptions = getAssetOptions(wallet);
    let page = 1;
    const assetsPerPage = config.maxAssetsPerPage;
    let moreAssets = true;
    while (moreAssets) {
      const url = getWaxApiUrl();
      // loggingUtil.log('getOwnedCardsToCache', 'url', url);
      const waxApi = getWaxApi(url);
      if (config.atomicAssetsLogSize) {
        console.log('owner', owner, 'wallet', wallet, 'page', page, 'allAssets.length', allAssets.length);
      }
      try {
        const pageAssets = await waxApi.getAssets(assetOptions, page, assetsPerPage);
        pageAssets.forEach((rawAsset) => {
          const asset = cloneAsset(rawAsset);
          // console.log('owner', owner, 'page', page, asset);
          const templateId = asset.template.template_id.toString();
          if (!excludedTemplateSet.has(templateId)) {
            if (includedSchemaSet.has(asset.schema.schema_name)) {
              allAssets.push(asset);
            }
          }
        });
        if (pageAssets.length < assetsPerPage) {
          moreAssets = false;
        }
        page++;
      } catch (error) {
        console.log('owner', owner, 'error.message', error.message);
        if (error.message == 'Only absolute URLs are supported') {
          const index = config.atomicAssetsEndpointsV2.indexOf(url);
          console.log('owner', owner, 'urle', url, 'index', index);
          if (index > -1) { // only splice array when item is found
            config.atomicAssetsEndpointsV2.splice(index, 1); // 2nd parameter means remove one item only
          }
        }
      }
    }
  }
  const allAssetsStr = JSON.stringify(allAssets);
  if (config.atomicAssetsLogSize) {
    console.log('owner', owner, 'allAssets.length', allAssets.length, 'allAssetsStr.length', allAssetsStr.length);
  }
  return JSON.parse(allAssetsStr);
};

const getFrozenCount = async (ownedCards) => {
  let frozenCount = 0;
  for (let ownedCardIx = 0; ownedCardIx < ownedCards.length; ownedCardIx++) {
    const ownedCard = ownedCards[ownedCardIx];
    const assetId = ownedCard.asset_id;
    const isAssetFrozenFlag = await assetUtil.isAssetFrozen(assetId);
    if (isAssetFrozenFlag) {
      frozenCount++;
    }
  }
  return frozenCount;
};

const thawOwnerAssetsIfItIsTime = async (ownedCards, frozenCount) => {
  for (let ownedCardIx = 0; ownedCardIx < ownedCards.length; ownedCardIx++) {
    const ownedCard = ownedCards[ownedCardIx];
    const assetId = ownedCard.asset_id;
    await assetUtil.thawAssetIfItIsTime(assetId);
  }
};

const getPayoutInformation = async (owner) => {
  const resp = {};
  resp.wallets = await loadWalletsForOwner(owner);
  resp.cardCount = 0;
  resp.templateCount = templates.length;
  // loggingUtil.log(dateUtil.getDate(), 'STARTED countCards');
  const ownedCards = await getOwnedCards(owner);
  const frozenAssetByTemplateMap = {};
  const unfrozenAssetByTemplateMap = {};
  const ownedAssets = [];

  resp.ownedAssets = ownedAssets;
  resp.frozenAssetByTemplateMap = frozenAssetByTemplateMap;
  resp.unfrozenAssetByTemplateMap = unfrozenAssetByTemplateMap;

  const frozenCount = await getFrozenCount(ownedCards);
  await thawOwnerAssetsIfItIsTime(ownedCards, frozenCount);

  for (let ownedCardIx = 0; ownedCardIx < ownedCards.length; ownedCardIx++) {
    const ownedCard = ownedCards[ownedCardIx];
    const assetId = ownedCard.asset_id;
    const templateId = ownedCard.template.template_id.toString();
    const isAssetFrozenFlag = await assetUtil.isAssetFrozen(assetId);
    if (isAssetFrozenFlag) {
      if (frozenAssetByTemplateMap[templateId] === undefined) {
        frozenAssetByTemplateMap[templateId] = [];
      }
      frozenAssetByTemplateMap[templateId].push(assetId);
    } else {
      if (unfrozenAssetByTemplateMap[templateId] === undefined) {
        unfrozenAssetByTemplateMap[templateId] = [];
      }
      unfrozenAssetByTemplateMap[templateId].push(assetId);
    }
    const ownedAsset = {};
    ownedAsset.name = ownedCard.template.immutable_data.name;
    ownedAsset.img = ownedCard.template.immutable_data.img;
    ownedAsset.rarity = ownedCard.template.immutable_data.rarity;
    ownedAsset.maxSupply = parseInt(ownedCard.template.max_supply, 10);
    ownedAsset.assetId = assetId;
    ownedAsset.templateId = templateId;
    ownedAsset.frozen = isAssetFrozenFlag;
    ownedAsset.thawTimeMs = await assetUtil.getThawTimeMs(assetId);
    ownedAssets.push(ownedAsset);
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
    // if (await atomicassetsUtil.ownerHasCard(owner, card.template_id)) {
    // resp.cardCount++;
    // }
  }
  // loggingUtil.log(dateUtil.getDate(), 'SUCCESS countCards');

  const winningOneCardOdds = resp.cardCount/resp.templateCount;
  const winningOdds = winningOneCardOdds;// * winningOneCardOdds * winningOneCardOdds;
  // const payoutAmountDenominator = winningOneCardOdds * winningOneCardOdds;

  if (winningOdds == 0) {
    resp.winningOdds = 0;
    resp.payoutAmount = 0;
  } else {
    resp.winningOdds = winningOdds;
    // resp.payoutAmount = parseInt((1./payoutAmountDenominator).toFixed(0), 10);
    resp.payoutAmount = 1;
  }

  // loggingUtil.log(dateUtil.getDate(), 'SUCCESS getPayoutInformation', resp);

  return resp;
};

const isReady = () => {
  return ready;
};

const getTemplates = () => {
  return templates;
};

const getActiveAccountList = () => {
  return [...ownerAssetCacheMap.keys()];
};

const getOwnerFile = (owner) => {
  if (owner === undefined) {
    throw new Error('account is required.');
  };

  const seedHash = crypto.createHash('sha256')
      .update(`${owner}`)
      .digest();
  const fileNm = seedHash.toString('hex') + '.json';

  return path.join(config.ownerWalletDataDir, fileNm);
};

const cloneAsset = (asset) => {
  const assetData = {};
  assetData.owner = asset.owner;
  assetData.asset_id = asset.asset_id;
  assetData.template = {};
  assetData.template.template_id = asset.template.template_id;
  assetData.template.immutable_data = {};
  assetData.template.immutable_data.name = asset.template.immutable_data.name;
  assetData.template.immutable_data.img = asset.template.immutable_data.img;
  assetData.template.immutable_data.rarity = asset.template.immutable_data.rarity;
  assetData.template.max_supply = asset.template.max_supply;
  assetData.schema = {};
  assetData.schema.schema_name = asset.schema.schema_name;
  return assetData;
};

const loadAllAssets = async () => {
  console.log(dateUtil.getDate(), 'STARTED loadAllAssets');
  const assetOptions = {'collection_name': 'crptomonkeys', 'schema_name': 'crptomonkeys'};
  let page = 1;
  let totalAssets = 0;
  const assetsPerPage = config.maxAssetsPerPage;
  let moreAssets = true;
  const assetMap = {};

  while (moreAssets) {
    const url = getWaxApiUrl();
    const waxApi = getWaxApi(url);
    try {
      const pageAssets = await waxApi.getAssets(assetOptions, page, assetsPerPage);
      console.log(dateUtil.getDate(), 'INTERIM loadAllAssets', 'page', page, 'totalAssets', totalAssets, 'url', url, 'pageAssets.length', pageAssets.length);
      pageAssets.forEach((rawAsset) => {
        const asset = cloneAsset(rawAsset);
        const owner = asset.owner;
        // console.log('owner', owner, 'page', page, asset);
        if (assetMap[owner] == undefined) {
          assetMap[owner] = [];
        }
        const templateId = asset.template.template_id.toString();
        if (!excludedTemplateSet.has(templateId)) {
          if (includedSchemaSet.has(asset.schema.schema_name)) {
            assetMap[owner].push(asset);
            totalAssets++;
          }
        }
      });
      if (pageAssets.length < assetsPerPage) {
        moreAssets = false;
      }
      page++;
    } catch (error) {
      if (error.message == 'Only absolute URLs are supported') {
        const index = config.atomicAssetsEndpointsV2.indexOf(url);
        if (index > -1) { // only splice array when item is found
          config.atomicAssetsEndpointsV2.splice(index, 1); // 2nd parameter means remove one item only
        }
      }
    }
  }
  const owners = Object.keys(assetMap);
  console.log(dateUtil.getDate(), 'INTERIM loadAllAssets', owners.length, 'owners');

  for (const owner of owners) {
    const getOwnedCardsCallback = () => {
      return assetMap[owner];
    };
    await timedCacheUtil.getUsingNamedCache('Owned Cards', ownerAssetCacheMap, owner,
        config.assetCacheTimeMs, getOwnedCardsCallback);
  }
  loggingUtil.log(dateUtil.getDate(), 'SUCCESS loadAllAssets');
};

const loadWalletsForOwner = async (owner) => {
  const mutexRelease = await mutex.acquire();
  try {
    const file = getOwnerFile(owner);
    if (!fs.existsSync(file)) {
      saveWalletsForOwnerInsideMutex(owner, [owner]);
    }
    const data = fs.readFileSync(file, 'UTF-8');
    const json = JSON.parse(data);
    return json.wallets;
  } finally {
    mutexRelease();
  }
};

const saveWalletsForOwnerInsideMutex = (owner, wallets) => {
  const file = getOwnerFile(owner);
  const filePtr = fs.openSync(file, 'w');
  fs.writeSync(filePtr, JSON.stringify({owner: owner, wallets: wallets}));
  fs.closeSync(filePtr);
};

const saveWalletsForOwner = async (owner, wallets) => {
  const mutexRelease = await mutex.acquire();
  try {
    saveWalletsForOwnerInsideMutex(owner, wallets);
  } finally {
    mutexRelease();
  }
};

const getOwnersWithWalletsList = async () => {
  const mutexRelease = await mutex.acquire();
  try {
    const owners = [];
    if (fs.existsSync(config.ownerWalletDataDir)) {
      const list = fs.readdirSync(config.ownerWalletDataDir);
      for (let ix = 0; ix < list.length; ix++) {
        const nm = list[ix];
        const file = path.join(config.ownerWalletDataDir, nm);
        const data = fs.readFileSync(file, 'UTF-8');
        const json = JSON.parse(data);
        owners.push(json.owner);
      }
    }
    return owners;
  } finally {
    mutexRelease();
  }
};

const sleep = async (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

const thawAllAssetsIfItIsTime = async () => {
  try {
    loggingUtil.log(dateUtil.getDate(), 'STARTED thawAllAssetsIfItIsTime');
    const owners = await getOwnersWithWalletsList();
    for (let ownerIx = 0; ownerIx < owners.length; ownerIx++) {
      if (ownerIx > 0) {
        await sleep(1000);
      }
      const owner = owners[ownerIx];
      const ownedCards = await getOwnedCards(owner);
      const frozenCount = await getFrozenCount(ownedCards);
      await thawOwnerAssetsIfItIsTime(ownedCards, frozenCount);
    }
    loggingUtil.log(dateUtil.getDate(), 'SUCCESS thawAllAssetsIfItIsTime');
  } catch (error) {
    loggingUtil.log(dateUtil.getDate(), 'FAILURE thawAllAssetsIfItIsTime');
    loggingUtil.trace(error);
  }
};

module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.getTemplateCount = getTemplateCount;
module.exports.hasOwnedCards = hasOwnedCards;
module.exports.getOwnedCards = getOwnedCards;
module.exports.getPayoutInformation = getPayoutInformation;
module.exports.isReady = isReady;
module.exports.getTemplates = getTemplates;
module.exports.getTotalActiveCardCount = getTotalActiveCardCount;
module.exports.getActiveCardHistogram = getActiveCardHistogram;
module.exports.getActiveAccountList = getActiveAccountList;
module.exports.loadWalletsForOwner = loadWalletsForOwner;
module.exports.saveWalletsForOwner = saveWalletsForOwner;
module.exports.isOwnerEligibleForGiveaway = isOwnerEligibleForGiveaway;
module.exports.getOwnersWithWalletsList = getOwnersWithWalletsList;
module.exports.setWaxApiAndAddTemplates = setWaxApiAndAddTemplates;
module.exports.getWaxApi = getWaxApi;
module.exports.loadAllAssets = loadAllAssets;
