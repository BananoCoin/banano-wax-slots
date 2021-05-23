const randomUtil = require('../scripts/util/random-util.js');

const NUM_PULLS = 100000;
const MAX_CARDS = 53;

const betLoss = 1;
// const betWin = 1;
const betWin = (betLoss * 1.9) + 0.1;

const loggingUtil = {};
loggingUtil.log = console.log;
loggingUtil.isDebugEnabled = () => {
  return false;
};
loggingUtil.debug = () => {};
// loggingUtil.debug = console.log;
loggingUtil.trace = console.trace;

const run = () => {
  randomUtil.init({}, loggingUtil);
  for (let playerCards = 0; playerCards <= MAX_CARDS; playerCards++) {
    let wins = 0;
    let losses = 0;
    for (let ix = 0; ix < NUM_PULLS; ix++) {
      const card0 = randomUtil.getRandomInt(1, MAX_CARDS+1);
      const card1 = randomUtil.getRandomInt(1, MAX_CARDS+1);
      const card2 = randomUtil.getRandomInt(1, MAX_CARDS+1);
      if (
        (card0 <= playerCards) ||
        (card1 <= playerCards) ||
        (card2 <= playerCards)
      ) {
        wins += betWin;
      } else {
        losses += betLoss;
      }
    }
    const chanceWin = playerCards / MAX_CARDS;
    const expectedPctLoss = Math.pow(1 - chanceWin, 3);
    const expectedPctWin = 1 - expectedPctLoss;
    const expectedPct = (betWin*expectedPctWin)/((betWin*expectedPctWin) + (betLoss*expectedPctLoss));
    const actualPct = wins/(wins+losses);
    const diff = Math.abs(expectedPct-actualPct);
    console.log('playerCards', playerCards.toString().padStart(4),
        'wins', wins.toString().padStart(5),
        'losses', losses.toString().padStart(5),
        'expectedPct', expectedPct.toFixed(5),
        'actualPct', actualPct.toFixed(5),
        'diff', diff.toFixed(5),
    );
  }
  randomUtil.deactivate();
};

run();
