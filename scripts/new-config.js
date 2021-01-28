'use strict';

const randomUtil = require('./util/random-util.js');

const newConfig = {};
newConfig.cookieSecret = randomUtil.getRandomHex32();
newConfig.waxIdSeed = randomUtil.getRandomHex32();
newConfig.centralWalletSeed = randomUtil.getRandomHex32();
newConfig.burnAccount = 'crptomonkeys';

console.log('STARTED new config');
console.log(JSON.stringify(newConfig, undefined, '\t'));
console.log('SUCCESS new config');
