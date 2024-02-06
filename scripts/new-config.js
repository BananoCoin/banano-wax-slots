'use strict';

import {getRandomHex32} from './util/random-util.js';

const newConfig = {};
newConfig.cookieSecret = getRandomHex32();
newConfig.waxIdSeed = getRandomHex32();
newConfig.centralWalletSeed = getRandomHex32();
newConfig.houseWalletSeed = getRandomHex32();
newConfig.burnAccount = 'crptomonkeys';
newConfig.underMaintenance = false;

console.log('STARTED new config');
console.log(JSON.stringify(newConfig, undefined, '\t'));
console.log('SUCCESS new config');
