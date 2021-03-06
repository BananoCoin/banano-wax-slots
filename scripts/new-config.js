'use strict';

const randomUtil = require('./util/random-util.js');

const newConfig = {};
newConfig.cookieSecret = randomUtil.getRandomHex32();
newConfig.waxIdSeed = randomUtil.getRandomHex32();
newConfig.centralWalletSeed = randomUtil.getRandomHex32();
newConfig.houseWalletSeed = randomUtil.getRandomHex32();
newConfig.burnAccount = 'crptomonkeys';
newConfig.underMaintenance = false;

console.log('STARTED new config');
console.log(JSON.stringify(newConfig, undefined, '\t'));
console.log('SUCCESS new config');
