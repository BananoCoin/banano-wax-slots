'use strict';
// libraries
const fs = require('fs');
const path = require('path');

// modules
const randomUtil = require('../../util/random-util.js');
const dateUtil = require('../../util/date-util.js');
const seedUtil = require('../../util/seed-util.js');
const nonceUtil = require('../../util/nonce-util.js');
const assetUtil = require('../../util/asset-util.js');
const atomicassetsUtil = require('../../util/atomicassets-util.js');
const bananojsCacheUtil = require('../../util/bananojs-cache-util.js');
const timedCacheUtil = require('../../util/timed-cache-util.js');

// constants
const PCT_SCALE = 100000;

// variables

/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
const checkPendingSeeds = new Set();
let totalWinsSinceRestart = 0;
let totalLossesSinceRestart = 0;
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
  setTimeout(centralAccountReceivePending, 0);
  setInterval(centralAccountReceivePending, config.centralWalletReceivePendingIntervalMs);


  if (!fs.existsSync(config.logsDataDir)) {
    fs.mkdirSync(config.logsDataDir, {recursive: true});
  }
};

const deactivate = async () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  /* eslint-enable no-unused-vars */
};

const post = async (context, req, res) => {
  try {
    return await postWithoutCatch(context, req, res);
  } catch (error) {
    console.log(dateUtil.getDate(), 'playUtil error', error.message);
    console.trace(error);
    const resp = {};
    resp.intermittentError = true;
    resp.ready = false;
    resp.errorMessage = error.message;
    res.send(resp);
  }
};

const receivePending = async (representative, seed) => {
  const account = await bananojsCacheUtil.getBananoAccountFromSeed(seed, config.walletSeedIx);
  const pendingList = [];
  let noPending = false;
  while (!noPending) {
    const pending = await bananojsCacheUtil.getAccountsPending([account], config.maxPendingBananos, true);
    if (config.centralWalletReceivePendingLoggingOn) {
      loggingUtil.log(dateUtil.getDate(), 'account', account, 'pending', pending.blocks[account]);
    }
    if (pending!== undefined) {
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
  }
  return pendingList;
};

const centralAccountReceivePending = async () => {
  try {
    if (config.centralWalletReceivePendingLoggingOn) {
      loggingUtil.log(dateUtil.getDate(), 'STARTED centralAccountReceivePending');
    }
    const centralAccount = await bananojsCacheUtil.getBananoAccountFromSeed(config.centralWalletSeed, config.walletSeedIx);
    const centralPendingList = await receivePending(centralAccount, config.centralWalletSeed);
    const seeds = [...checkPendingSeeds];
    seeds.push(config.houseWalletSeed);
    for (let seedIx = 0; seedIx < seeds.length; seedIx++) {
      const seed = seeds[seedIx];
      const pendingList = await receivePending(centralAccount, seed);
      if (config.centralWalletReceivePendingLoggingOn) {
        loggingUtil.log(dateUtil.getDate(), 'pendingList', pendingList);
      }
      checkPendingSeeds.delete(seed);
    }
    if (config.centralWalletReceivePendingLoggingOn) {
      loggingUtil.log(dateUtil.getDate(), 'SUCCESS centralAccountReceivePending', centralPendingList);
    }
  } catch (error) {
    loggingUtil.log(dateUtil.getDate(), 'FAILURE centralAccountReceivePending', error.message);
    console.trace(error);
  }
};

const postWithoutCatch = async (context, req, res) => {
  if (config.underMaintenance) {
    loggingUtil.log(dateUtil.getDate(), 'play', 'under maintenance');
    const resp = {};
    resp.errorMessage = 'under maintenance';
    resp.underMaintenance = true;
    resp.ready = false;
    res.send(resp);
    return;
  }
  if (!atomicassetsUtil.isReady()) {
    loggingUtil.log(dateUtil.getDate(), 'play', 'not ready');
    const resp = {};
    resp.intermittentError = true;
    resp.errorMessage = 'not ready';
    resp.ready = false;
    res.send(resp);
    return;
  }
  // loggingUtil.log(dateUtil.getDate(), 'STARTED play', req.body);
  const nonce = req.body.nonce;
  if (nonce == undefined) {
    loggingUtil.log(dateUtil.getDate(), 'play', 'no nonce');
    const resp = {};
    resp.errorMessage = 'no nonce';
    resp.ready = false;
    res.send(resp);
    return;
  }
  // loggingUtil.log(dateUtil.getDate(), 'STARTED play', req.body);
  const nonceKind = req.body.nonce_kind;
  if (nonceKind == undefined) {
    loggingUtil.log(dateUtil.getDate(), 'play', 'no nonce_kind');
    const resp = {};
    resp.errorMessage = 'no nonce_kind';
    resp.ready = false;
    res.send(resp);
    return;
  }
  // loggingUtil.log(dateUtil.getDate(), 'nonce');// , owner);

  const houseAccount = await bananojsCacheUtil.getBananoAccountFromSeed(config.houseWalletSeed, config.walletSeedIx);

  const owner = req.body.owner;
  if (owner == undefined) {
    loggingUtil.log(dateUtil.getDate(), 'play', 'no owner');
    const resp = {};
    resp.errorMessage = 'no owner';
    resp.ready = false;
    res.send(resp);
    return;
  }
  // loggingUtil.log(dateUtil.getDate(), 'owner');// , owner);

  const badNonce = await nonceUtil.isBadNonce(owner, nonce, nonceKind);
  if (badNonce) {
    const resp = {};
    resp.errorMessage = `Nonce mismatch, log in again.`;
    resp.ready = false;
    res.send(resp);
    return;
  }

  const seed = seedUtil.getSeedFromOwner(owner);
  // loggingUtil.log(dateUtil.getDate(), 'seed');// , seed);
  const account = await bananojsCacheUtil.getBananoAccountFromSeed(seed, config.walletSeedIx);
  if (config.centralWalletReceivePendingLoggingOn) {
    loggingUtil.log(dateUtil.getDate(), 'checkPendingSeeds.add', account);
  }
  checkPendingSeeds.add(seed);

  const resp = {};
  resp.ready = true;
  resp.account = account;
  resp.houseAccount = houseAccount;
  resp.cards = [];
  resp.score = ['No Current Bet.', 'Press the \'Play\' button to continue.'];
  resp.scoreError = false;
  resp.templateCount = atomicassetsUtil.getTemplateCount();
  let won = false;
  let maxBet = 0;

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
      resp.betBonus = await getBetBonus(houseAccountInfo.cacheBalance);
      resp.betBonus = parseFloat(resp.betBonus);

      resp.bets = await getBets(houseAccountInfo.cacheBalance);
      maxBet = await getMaxBet(houseAccountInfo.cacheBalance);
    }
    resp.cacheHouseBalanceParts = await bananojsCacheUtil.getBananoPartsFromRaw(houseAccountInfo.cacheBalance);
    resp.cacheHouseBalanceDescription = await bananojsCacheUtil.getBananoPartsDescription(resp.cacheHouseBalanceParts);
    resp.cacheHouseBalanceDecimal = await bananojsCacheUtil.getBananoPartsAsDecimal(resp.cacheHouseBalanceParts);
    if (!resp.accountInfo.error) {
      resp.balanceParts = await bananojsCacheUtil.getBananoPartsFromRaw(accountInfo.balance);
      resp.balanceDescription = await bananojsCacheUtil.getBananoPartsDescription(resp.balanceParts);
      resp.balanceDecimal = await bananojsCacheUtil.getBananoPartsAsDecimal(resp.balanceParts);
    }
    resp.cacheBalanceParts = await bananojsCacheUtil.getBananoPartsFromRaw(resp.accountInfo.cacheBalance);
    resp.cacheBalanceDescription = await bananojsCacheUtil.getBananoPartsDescription(resp.cacheBalanceParts);
    resp.cacheBalanceDecimal = await bananojsCacheUtil.getBananoPartsAsDecimal(resp.cacheBalanceParts);
  };
  await updateBalances();

  const payoutInformation = await atomicassetsUtil.getPayoutInformation(owner);
  resp.payoutAmount = payoutInformation.payoutAmount;
  resp.payoutAmount = parseFloat(resp.payoutAmount);

  resp.cardCount = payoutInformation.cardCount;
  resp.ownedAssets = payoutInformation.ownedAssets;

  resp.payoutMultiplier = config.payoutMultiplier;
  resp.payoutMultiplier = parseFloat(resp.payoutMultiplier);

  resp.unfrozenCardCount = 0;
  resp.ownedAssets.forEach((ownedAsset) => {
    if (!ownedAsset.frozen) {
      resp.unfrozenCardCount++;
    }
  });

  const banano = parseFloat(resp.cacheBalanceDecimal);

  let play = true;
  if (req.body.bet === undefined) {
    play = false;
  }
  const minBet = parseFloat(config.minBet);
  if (resp.cacheBalanceDecimal < minBet) {
    play = false;
    resp.score = [`Account balance too low.`, `Min balance:${minBet.toFixed(4)}`];
    resp.scoreError = true;
  }
  if (resp.houseAccountInfo.error) {
    play = false;
    resp.score = [`House Account has zero balance.','Please add at least one banano.`];
    resp.scoreError = true;
  }

  // loggingUtil.log(dateUtil.getDate(), 'resp.payoutAmount', resp.payoutAmount, 'resp.payoutMultiplier', resp.payoutMultiplier, 'resp.betBonus', resp.betBonus);

  if (play) {
    const houseBanano = parseInt(resp.cacheHouseBalanceParts[resp.cacheHouseBalanceParts.majorName], 10);
    const bet = parseFloat(req.body.bet);

    const winPayment = ((resp.payoutAmount * bet * resp.payoutMultiplier) + resp.betBonus).toFixed(4);

    if (!Number.isFinite(bet)) {
      resp.score = [`Bad Bet '${req.body.bet}'`];
      resp.scoreError = true;
    } else if (bet > banano) {
      resp.score = [`Low Balance. Bet '${bet}' greater than balance '${banano.toFixed(4)}'`];
      resp.scoreError = true;
    } else if (bet < minBet) {
      resp.score = [`Min Bet ${minBet.toFixed(4)} Ban`];
      resp.scoreError = true;
    } else if (bet > maxBet) {
      resp.score = [`Max Bet ${maxBet.toFixed(4)} Ban`];
      resp.scoreError = true;
    } else if (winPayment > houseBanano) {
      resp.score = ['Low House Balance.', `${winPayment} = Bet:${bet} X odds:${resp.payoutAmount} X mult:${resp.payoutMultiplier}`, `${houseBanano} = House balance`];
      resp.scoreError = true;
    } else {
      won = false;
      resp.score = ['Lost'];
      resp.scoreError = false;
      const templates = atomicassetsUtil.getTemplates();
      let card1 = undefined;
      if (bet == 0) {
        for (let templateIx = 0; ((templateIx < templates.length) &&
            (card1 == undefined)); templateIx++) {
          const card = templates[templateIx];
          const unfrozenAssets = payoutInformation.unfrozenAssetByTemplateMap[card.template_id];
          if (unfrozenAssets !== undefined) {
            if (unfrozenAssets.length > 0) {
              card1 = card;
            }
          }
        }
      }
      if (card1 == undefined) {
        card1 = randomUtil.getRandomArrayElt(templates);
      } else {
        loggingUtil.log(dateUtil.getDate(), 'owner', owner, 'account', account, 'banano', banano, 'bet', bet, 'free win');
      }
      const card2 = randomUtil.getRandomArrayElt(templates);
      const card3 = randomUtil.getRandomArrayElt(templates);
      const cards = [card1, card2, card3];
      // loggingUtil.log(dateUtil.getDate(), 'STARTED checkCards');

      const unfrozenCardData = {};
      for (let cardIx = 0; cardIx < cards.length; cardIx++) {
        const card = cards[cardIx];
        const cardData = {};
        const unfrozenAssets = payoutInformation.unfrozenAssetByTemplateMap[card.template_id];
        const frozenAssets = payoutInformation.frozenAssetByTemplateMap[card.template_id];

        cardData.name = card.name;
        cardData.ipfs = card.img;
        cardData.frozenCardCount = 0;
        cardData.totalCardCount = 0;
        cardData.frozen = true;

        if (unfrozenAssets === undefined) {
        } else if (unfrozenAssets.length == 0) {
        } else {
          unfrozenCardData[cardIx] = cardData;
          cardData.totalCardCount += unfrozenAssets.length;
          cardData.frozen = false;
        }

        if (frozenAssets === undefined) {
        } else if (frozenAssets.length == 0) {
        } else {
          cardData.totalCardCount += frozenAssets.length;
          cardData.frozenCardCount += frozenAssets.length;
        }
        cardData.grayscale = cardData.totalCardCount == 0;
        if (cardData.grayscale) {
          cardData.frozen = false;
        }

        // loggingUtil.log('INTERIM play', cardIx, 'card', card);
        if ((!cardData.grayscale) && (!cardData.frozen)) {
          resp.score = ['Won'];
          won = true;
        }
        resp.cards.push(cardData);
      }
      if (won) {
        for (let cardIx = 0; cardIx < cards.length; cardIx++) {
          const card = cards[cardIx];
          const assets = payoutInformation.unfrozenAssetByTemplateMap[card.template_id];
          if (assets !== undefined) {
            const assetId = assets[0];
            assetUtil.freezeAsset(assetId);

            resp.ownedAssets.forEach((ownedAsset) => {
              if (ownedAsset.assetId == assetId) {
                ownedAsset.newFrozen = true;
              }
            });
            if (assets.length == 1) {
              resp.cardCount--;
            }
          }
        }
      }

      const referredBy = req.body.referred_by;
      let payReferral = false;
      let referredByAccount;
      let referredByPayment;
      if (referredBy !== undefined) {
        if (referredBy !== owner) {
          payReferral = true;
          const referredBySeed = seedUtil.getSeedFromOwner(referredBy);
          referredByAccount = await bananojsCacheUtil.getBananoAccountFromSeed(referredBySeed, config.walletSeedIx);
          referredByPayment = (winPayment * config.referredByBonusPercent).toFixed(4);
        }
      }

      // loggingUtil.log(dateUtil.getDate(), 'SUCCESS checkCards');
      const payout = async () => {
        try {
          if (won) {
            totalWinsSinceRestart++;
            await bananojsCacheUtil.sendBananoWithdrawalFromSeed(config.houseWalletSeed, config.walletSeedIx, account, winPayment);

            if (payReferral) {
              await bananojsCacheUtil.sendBananoWithdrawalFromSeed(config.houseWalletSeed, config.walletSeedIx, referredByAccount, referredByPayment);
            }
          } else {
            totalLossesSinceRestart++;
            await bananojsCacheUtil.sendBananoWithdrawalFromSeed(seed, config.walletSeedIx, houseAccount, bet);
          }
          await updateBalances();
        } catch (error) {
          console.log('payout error', error.message);
          console.trace(error);
        }
      };

      loggingUtil.log(dateUtil.getDate(), 'owner', owner, 'account', account, 'banano', banano, 'bet', bet, 'winPayment', winPayment, 'house balance', houseBanano, houseAccount, 'won', won, 'uniqueCardCount', resp.cardCount, 'totalCardCount', resp.ownedAssets.length, 'unfrozenCardCount', resp.unfrozenCardCount, 'payReferral', payReferral, 'referredBy', referredBy, 'referredByAccount', referredByAccount, 'referredByPayment', referredByPayment);
      await payout();
      if (won) {
        logWin(owner, account, bet, winPayment);
      }
    }
  }
  resp.activeWaxUserList = atomicassetsUtil.getActiveAccountList();
  resp.activeUsers = bananojsCacheUtil.getActiveAccountCount();
  resp.activeUsersSinceRestart = nonceUtil.getCachedNonceCount();
  resp.totalUsers = bananojsCacheUtil.getTotalAccountCount();
  resp.totalFrozenCards = assetUtil.getTotalFrozenAssetCount();
  resp.totalActiveCards = atomicassetsUtil.getTotalActiveCardCount();
  resp.totalWinsSinceRestart = totalWinsSinceRestart;
  resp.totalLossesSinceRestart = totalLossesSinceRestart;
  resp.cacheMissCountMap = [...timedCacheUtil.getCacheMissCountMap()];
  resp.cacheHitCountMap = [...timedCacheUtil.getCacheHitCountMap()];

  // loggingUtil.log(dateUtil.getDate(), 'resp', resp);

  res.send(resp);
};

const getPercentOfHouseBalanceAsDecimal = async (houseBalanceRaw, pct) => {
  /* istanbul ignore if */
  if (houseBalanceRaw === undefined) {
    throw new Error('houseBalanceRaw is required.');
  };
  /* istanbul ignore if */
  if (pct === undefined) {
    throw new Error('pct is required.');
  };

  houseBalanceRaw = BigInt(houseBalanceRaw);

  const cappedHouseBalanceRaw = BigInt(await bananojsCacheUtil.getBananoDecimalAmountAsRaw(parseFloat(config.cappedHouseBalance)));

  // console.log('houseBalanceRaw1     ', houseBalanceRaw);
  // console.log('cappedHouseBalanceRaw', cappedHouseBalanceRaw);
  if (houseBalanceRaw > cappedHouseBalanceRaw) {
    houseBalanceRaw = cappedHouseBalanceRaw;
  }
  // console.log('houseBalanceRaw2     ', houseBalanceRaw);

  const scaleBi = BigInt(PCT_SCALE);
  const per = BigInt(parseInt(parseFloat(pct) * PCT_SCALE, 10));
  const raw = (houseBalanceRaw * BigInt(per)) / scaleBi;
  const parts = await bananojsCacheUtil.getBananoPartsFromRaw(raw);

  const rawBi = BigInt(parts.raw);
  const stripPart = rawBi % BigInt(100);
  const truncRaw = rawBi - stripPart;
  parts.raw = truncRaw.toString();

  // delete parts.raw;
  const decimal = await bananojsCacheUtil.getBananoPartsAsDecimal(parts);
  return decimal;
};

const getMaxBet = async (houseBalanceRaw) => {
  const bets = await getBets(houseBalanceRaw);
  const keys = [...Object.keys(bets)];
  let maxBet = bets[keys[0]];
  for (let ix = 1; ix < keys.length; ix++) {
    const key = keys[ix];
    const bet = bets[key];
    maxBet = Math.max(maxBet, bet);
  }
  return (parseFloat(maxBet) * 1.01);
};

const getBets = async (houseBalanceRaw) => {
  const bets = {};
  const keys = [...Object.keys(config.betsPct)];
  for (let ix = 0; ix < keys.length; ix++) {
    const key = keys[ix];
    const pct = config.betsPct[key];
    const value = await getPercentOfHouseBalanceAsDecimal(houseBalanceRaw, pct);
    bets[key] = value;
  }
  return bets;
};

const getBetBonus = async (houseBalanceRaw) => {
  const betBonusDecimal = await getPercentOfHouseBalanceAsDecimal(houseBalanceRaw, config.betBonusPct);
  return betBonusDecimal;
};

const logWin = (owner, account, bet, winPayment) => {
  const winLogFileNm = path.join(config.logsDataDir, 'wins.txt');
  if (!fs.existsSync(winLogFileNm)) {
    const header = '"owner","account","bet","winPayment"\r\n';
    fs.appendFileSync(winLogFileNm, header);
  }
  const msg = `"${owner}","${account}","${bet}","${winPayment}"\r\n`;
  fs.appendFileSync(winLogFileNm, msg);
};

// exports
module.exports.init = init;
module.exports.deactivate = deactivate;
module.exports.post = post;
