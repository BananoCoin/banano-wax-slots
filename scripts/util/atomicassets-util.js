'use strict';
// libraries
const fetch = require('node-fetch');
const {ExplorerApi} = require('atomicassets');
const fs = require('fs');
const request = require('request');
const sharp = require('sharp');

// modules
const assetUtil = require('./asset-util.js');
const dateUtil = require('./date-util.js');
const timedCacheUtil = require('./timed-cache-util.js');
const walletsForOwner = new Map();

// constants

// variables
/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
let waxApi;
const templates = [];
let ready = false;
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
  setTimeout(setWaxApiAndAddTemplates, 0);
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  /* eslint-enable no-unused-vars */
  waxApi = undefined;
  templates.length = 0;
  ready = false;
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
};

const addAllTemplates = async () => {
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
      const pageTemplates = await waxApi.getTemplates({'collection_name': 'crptomonkeys'}, page, max);
      lessThanMax = pageTemplates.length < max;
      loggingUtil.log(dateUtil.getDate(), 'INTERIM addTemplates page', page, pageTemplates.length, max);

      for (let pageTemplateIx = 0; pageTemplateIx < pageTemplates.length; pageTemplateIx++) {
        const pageTemplate = pageTemplates[pageTemplateIx];
        // loggingUtil.log(dateUtil.getDate(), 'STARTED addTemplates pageTemplate', pageTemplate);
        const pageTemplateData = {};
        pageTemplateData.template_id = pageTemplate.template_id;
        pageTemplateData.schema_name = pageTemplate.schema.schema_name;
        pageTemplateData.name = pageTemplate.immutable_data.name;
        pageTemplateData.img = pageTemplate.immutable_data.img;
        pageTemplateData.backimg = pageTemplate.immutable_data.backimg;
        pageTemplateData.issued_supply = parseInt(pageTemplate.issued_supply, 10);
        pageTemplateData.max_supply = parseInt(pageTemplate.max_supply, 10);

        if (!excludedTemplateSet.has(pageTemplateData.template_id)) {
          if (includedSchemaSet.has(pageTemplateData.schema_name)) {
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
};

const getTemplateCount = () => {
  return templates.length;
};

const getAssetOptions = (owner) => {
  return {'collection_name': 'crptomonkeys', 'owner': owner};
};

const hasOwnedCards = async (owner) => {
  const wallets = getWalletsForOwner(owner);
  for (let ix = 0; ix < wallets.length; ix++) {
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
    const isAssetFrozenFlag = assetUtil.isAssetFrozen(assetId);
    if (isAssetFrozenFlag) {
      frozenCount++;
    }
    if (frozenCount >= config.minGiveawayBetCount) {
      return true;
    }
  }
  return false;
};

const getTotalActiveCardCount = () => {
  return timedCacheUtil.getCacheSize(ownerAssetCacheMap);
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
  const wallets = getWalletsForOwner(owner);
  for (let ix = 0; ix < wallets.length; ix++) {
    const wallet = wallets[ix];
    const assetOptions = getAssetOptions(wallet);
    let page = 1;
    const assetsPerPage = config.maxAssetsPerPage;
    let moreAssets = true;
    while (moreAssets) {
      // console.log('owner', owner, 'page', page, allAssets.length);
      const pageAssets = await waxApi.getAssets(assetOptions, page, assetsPerPage);
      pageAssets.forEach((asset) => {
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
    }
  }
  return allAssets;
};

const getPayoutInformation = async (owner) => {
  const resp = {};
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

  let frozenCount = 0;
  for (let ownedCardIx = 0; ownedCardIx < ownedCards.length; ownedCardIx++) {
    const ownedCard = ownedCards[ownedCardIx];
    const assetId = ownedCard.asset_id;
    const isAssetFrozenFlag = assetUtil.isAssetFrozen(assetId);
    if (isAssetFrozenFlag) {
      frozenCount++;
    }
  }

  for (let ownedCardIx = 0; ownedCardIx < ownedCards.length; ownedCardIx++) {
    const ownedCard = ownedCards[ownedCardIx];
    const assetId = ownedCard.asset_id;
    const rarity = ownedCard.data.rarity.toLowerCase();
    assetUtil.thawAssetIfItIsTime(assetId, rarity, frozenCount);
    const templateId = ownedCard.template.template_id.toString();
    const isAssetFrozenFlag = assetUtil.isAssetFrozen(assetId);
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
    ownedAsset.thawTimeMs = assetUtil.getThawTimeMs(assetId, rarity, frozenCount);
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

const getWalletsForOwner = (owner) => {
  if (walletsForOwner.has(owner)) {
    return walletsForOwner.get(owner);
  } else {
    return [owner];
  }
};

const setWalletsForOwner = (owner, wallets) => {
  walletsForOwner.set(owner, wallets);
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
module.exports.getActiveAccountList = getActiveAccountList;
module.exports.setWalletsForOwner = setWalletsForOwner;
module.exports.isOwnerEligibleForGiveaway = isOwnerEligibleForGiveaway;
