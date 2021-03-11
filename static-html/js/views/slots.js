import {waxjs} from '../../js-lib/waxjs-0.0.14.js';
import {blake2bInit, blake2bUpdate, blake2bFinal} from '../../js-lib/blake2b.js';
import {bananojs} from '../../js-lib/bananocoin-bananojs-2.2.2.js';
import {getDate} from '../../js-lib/date-util.js';

const wax = new waxjs.WaxJS('https://wax.greymass.com', null, null, false);

let owner;
let cardData;
let walletKind;
let betFromSvgId = '1ban';
let betFromSvg = 0;

const sounds = ['start', 'wheel', 'winner', 'loser', 'money'];

const startSound = (id) => {
  document.getElementById(id).play();
};

const stopSounds = () => {
  for (let ix = 0; ix < sounds.length; ix++) {
    const id = sounds[ix];
    document.getElementById(id).pause();
    document.getElementById(id).currentTime = 0;
  }
};

window.waxjsWallet = async () => {
  walletKind = 'waxjs';
  resetNonceAndOwner();
};

window.anchorWallet = async () => {
  walletKind = 'anchor';
  resetNonceAndOwner();
};

window.resetNonceAndOwner = async () => {
  delete window.localStorage.nonce;
  delete window.localStorage.owner;
  owner = undefined;
  window.onLoad();
};

const play = async (bet) => {
  const xmlhttp = new XMLHttpRequest();
  const parms = {};
  parms.owner = window.localStorage.owner;
  parms.nonce = window.localStorage.nonce;

  if (bet) {
    parms.bet = betFromSvg;
  }
  setScore('pending...');
  setAllTopTo(`<span class="small">pending...</span>`, 'pending...', 'pending...');

  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      cardData = JSON.parse(this.responseText);
      console.log('cardData', cardData);
      document.querySelector('#play').disabled = false;
      setScore('Ready to begin. Press Play!', 'lightgreen', 'green');
      addCards();
      stopSounds();
      if (cardData.ready) {
        if (cardData.score[0] == 'Lost') {
          startSound('loser');
        }
        if (cardData.score[0] == 'Won') {
          startSound('winner');
          startSound('money');
        }
      }
    }
  };
  if (bet) {
    stopSounds();
    if (window.localStorage.owner !== undefined) {
      startSound('start');
      startSound('wheel');
    }
  }
  xmlhttp.open('POST', '/play', true);
  xmlhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xmlhttp.send(JSON.stringify(parms));
  document.querySelector('#play').disabled = true;
};

window.play = () => {
  play(true);
};

window.getLastNonce = async () => {
  const lastNonceElt = document.querySelector('#lastNonceHash');
  const ownerActions = await wax.rpc.history_get_actions(owner, -1, -2);
  const ownerAction = ownerActions.actions[0];
  try {
    const lastNonce = ownerAction.action_trace.act.data.assoc_id;
    lastNonceElt.innerText = lastNonce;
    setScore('');
    addCards();
  } catch (error) {
    setScore('Nonce Error:' + error.message);
  }
};

const bytesToHex = (bytes) => {
  return Array.prototype.map.call(bytes, (x) => ('00' + x.toString(16)).slice(-2)).join('').toUpperCase();
};

const getInt64StrFromUint8Array = (ba) => {
  const hex = bytesToHex(ba);
  const bi = BigInt('0x' + hex);
  const max = BigInt('0x7FFFFFFFFFFFFFFF');
  return (bi%max).toString();
};

const synchBetButtons = (selectedId) => {
  betFromSvgId = selectedId;
  if (cardData !== undefined) {
    const idAmounts = cardData.bets;
    const ids = Object.keys(idAmounts);
    ids.forEach((id) => {
      getSvgSlotMachineElementById(id).setAttribute('fill', '#7b7b7b');
      const textElt = getSvgSlotMachineElementById(id+'-text');
      const text = parseFloat(idAmounts[id]).toFixed(2);
      // console.log('synchBetButtons', textElt, text);
      textElt.textContent = text;
    });
    betFromSvg = idAmounts[selectedId];
    getSvgSlotMachineElementById(selectedId).setAttribute('fill', '#000000');
  }
};

const addPlayArmListeners = (id) => {
  const elt = getSvgSlotMachineElementById(id);
  elt.addEventListener('click', () => {
    if (document.querySelector('#play').disabled) {
      return false;
    }
    window.play();
    return false;
  });
  elt.addEventListener('mouseleave', () => {
    elt.setAttribute('stroke', '#000000');
  });
  elt.addEventListener('mouseenter', () => {
    elt.setAttribute('stroke', '#AAAAAA');
  });
};

const addBetListeners = (selectedId) => {
  const elt = getSvgSlotMachineElementById(selectedId);
  elt.addEventListener('click', () => {
    synchBetButtons(selectedId);
  });
  elt.addEventListener('mouseleave', () => {
    elt.setAttribute('stroke', '#000000');
  });
  elt.addEventListener('mouseenter', () => {
    elt.setAttribute('stroke', '#AAAAAA');
  });
};

window.onLoad = async () => {
  addBetListeners('1ban');
  addBetListeners('5ban');
  addBetListeners('10ban');
  addBetListeners('50ban');
  addPlayArmListeners('playArm');

  const burnAccount = document.querySelector('#burnAccount').innerText;
  // const collection = await api.getCollection("crptomonkeys", false);
  // console.log(collection);
  const ownerElt = document.querySelector('#owner');
  const cardElt = document.querySelector('#cards');
  const nonceElt = document.querySelector('#nonce');
  const nonceHashElt = document.querySelector('#nonceHash');
  const lastNonceElt = document.querySelector('#lastNonceHash');
  lastNonceElt.innerHTML = '';

  if (window.localStorage.nonce === undefined) {
    const nonceBytes = new Uint8Array(16);
    window.crypto.getRandomValues(nonceBytes);
    const nonce = getInt64StrFromUint8Array(nonceBytes);
    window.localStorage.nonce = nonce;
  }
  if (window.localStorage.owner !== undefined) {
    owner = window.localStorage.owner;
  }
  if (owner !== undefined) {
    ownerElt.innerHTML = `<span>${owner}</span>`;
  } else {
    ownerElt.innerHTML = `<span>&nbsp;</span>`;
  }
  const nonce = window.localStorage.nonce;

  if (nonce !== undefined) {
    nonceElt.innerText = nonce;
  } else {
    nonceElt.innerText = '';
  }
  setAllTopTo('', '', '');

  const context = blake2bInit(32, null);
  blake2bUpdate(context, nonce);
  const nonceHash = getInt64StrFromUint8Array(blake2bFinal(context));
  nonceHashElt.innerText = nonceHash;

  try {
    if (owner === undefined) {
      if (walletKind == 'waxjs') {
        autoLogin();
      }
      if (walletKind == 'anchor') {
        anchorLogin();
      }
      owner = burnAccount;
    }

    const getLastNonceAndAddTemplates = async () => {
      await window.getLastNonce();
      play(false);
    };

    // if owner set, get tempate with owner.
    // otherwise get with burn address, to show 'bad nonce' message.
    getLastNonceAndAddTemplates();

    async function anchorLogin() {
      const transport = new AnchorLinkBrowserTransport();
      const waxChainId = '1064487b3cd1a897ce03ae5b6a865651747e2e152090f99c1d19d44e01aea5a4';
      const waxRpcUrl = 'https://chain.wax.io';
      const link = new AnchorLink({transport: transport, chainId: waxChainId, rpc: waxRpcUrl});
      console.log('link', link);
      try {
        const session = await link.login('waxslots');
        console.log('session', session);
        const userAccount = session.account.account_name;
        owner = userAccount;
        window.localStorage.owner = owner;
        ownerElt.innerHTML = `<span>${owner}</span>`;

        const result = await session.session.transact({
          actions: [{
            account: 'orng.wax',
            name: 'requestrand',
            authorization: [{
              actor: userAccount,
              permission: 'active',
            }],
            data: {
              caller: userAccount,
              signing_value: nonceHash,
              assoc_id: nonceHash,
            },
          }],
        }, {
          blocksBehind: 3,
          expireSeconds: 30,
        });
        console.log('result', result);
        document.getElementById('transaction_id').innerHTML = result.transaction_id;
        const scoreText = ['Please wait 30 seconds past', getDate(), 'For blockchain to update.'];
        setScore(scoreText);
        setTimeout(getLastNonceAndAddTemplates, 5000);
      } catch (error) {
        console.log('error', error.message);
        ownerElt.innerHTML = `<span>${error.message}</span>`;
      }
    };


    async function autoLogin() {
      const isAutoLoginAvailable = await wax.isAutoLoginAvailable();
      if (isAutoLoginAvailable) {
        const userAccount = wax.userAccount;
        owner = userAccount;
        window.localStorage.owner = owner;
        ownerElt.innerHTML = `<span>${owner}</span>`;
        setTimeout(nonceTx, 0);
      } else {
        ownerElt.innerHTML = `<span>Not auto-logged in</span>`;
        login();
      }
    }

    async function login() {
      try {
        const userAccount = await wax.login();
        owner = userAccount;
        window.localStorage.owner = owner;
        ownerElt.innerHTML = `<span>${owner}</span>`;
        setTimeout(nonceTx, 0);
      } catch (e) {
        console.log(e.message);
        ownerElt.innerHTML = `<span>${e.message}</span>`;
      }
    }

    const nonceTx = async () => {
      try {
        const result = await wax.api.transact({
          actions: [{
            account: 'orng.wax',
            name: 'requestrand',
            authorization: [{
              actor: wax.userAccount,
              permission: 'active',
            }],
            data: {
              caller: wax.userAccount,
              signing_value: nonceHash,
              assoc_id: nonceHash,
            },
          }],
        }, {
          blocksBehind: 3,
          expireSeconds: 30,
        });
        console.log(result);
        document.getElementById('transaction_id').innerHTML = result.transaction_id;
        const scoreText = ['Please wait 30 seconds past', getDate(), 'For blockchain to update.'];
        setScore(scoreText);
        setTimeout(getLastNonceAndAddTemplates, 5000);
      } catch (e) {
        document.getElementById('transaction_id').innerHTML = e.message;
      }
    };
  } catch (e) {
    console.log(e.message);
    document.getElementById('owner').innerHTML = `<span>${e.message}</span>`;
  }
};

const setAllTopTo = (logInHtml, accountBalance, accountBalanceTooltip) => {
  // console.trace('setAllTopTo');
  document.getElementById('account').innerHTML = logInHtml;
  setAccountCacheBalance(accountBalance, accountBalanceTooltip);
  document.getElementById('houseAccountBalance').innerHTML = logInHtml;
  document.getElementById('houseAccountCacheBalance').innerHTML = logInHtml;
};

const truncate = (number) => {
  const ix = number.indexOf('.');
  if (ix < 0) {
    return number;
  }
  return number.substring(0, ix+3);
};

const addCards = async () => {
  synchBetButtons(betFromSvgId);
  const lastNonceHashElt = document.querySelector('#lastNonceHash');
  const nonceHashElt = document.querySelector('#nonceHash');

  const scoreElt = document.querySelector('#score');
  if (lastNonceHashElt.innerText != nonceHashElt.innerText) {
    setScore('Need to log in again.', 'local nonce hash has does not match', 'blockchain nonce hash.');
    const logInHtml = '<span class="bg_color_red">Log In</span>';
    document.getElementById('owner').innerHTML = logInHtml;
    setAllTopTo(logInHtml, 'Log In', 'Log In');
    return;
  }
  const accountElt = document.querySelector('#account');
  const houseAccountElt = document.querySelector('#houseAccount');
  const houseAccountBalanceElt = document.querySelector('#houseAccountBalance');
  const houseAccountCacheBalanceElt = document.querySelector('#houseAccountCacheBalance');

  const card1Elt = getSvgSlotMachineElementById('card1');
  const card2Elt = getSvgSlotMachineElementById('card2');
  const card3Elt = getSvgSlotMachineElementById('card3');
  const setCard = (cardElt, cardDataElt) => {
    const innerHTML = '';
    let border = '';
    if (cardDataElt.frozen) {
      border = 'border-width:0.2vh;border-color:blue;background-color:lightblue;';
    } else if (cardData.score[0] == 'Won') {
      border = 'border-width:0.2vh;border-color:green;background-color:lightgreen;';
    } else {
      border = 'border-width:0.2vh;border-color:black;background-color:white;';
    }
    // innerHTML += `<span class="bordered" style="${border}">`;
    let filter = '';
    if (cardDataElt.grayscale) {
      filter = `url(#grayscale)`;
    }
    const href = `https://wax.atomichub.io/market?collection_name=crptomonkeys&match=${encodeURIComponent(cardDataElt.name)}&order=asc&sort=price&symbol=WAX`;

    const src = `/ipfs/${cardDataElt.ipfs}.webp`;
    clear(cardElt);
    cardElt.setAttribute('class', 'bordered');
    cardElt.setAttribute('style', border);
    if (cardDataElt.frozen) {
      addChildSvgElement(cardElt, 'rect', {'x': 0, 'y': 0, 'width': 86, 'height': 125, 'fill': 'lightblue', 'stroke': 'blue'});
    } else if (cardData.score[0] == 'Won') {
      addChildSvgElement(cardElt, 'rect', {'x': 0, 'y': 0, 'width': 86, 'height': 125, 'fill': 'lightgreen', 'stroke': 'green'});
    }
    const cardTitle = `${cardDataElt.name} (${cardDataElt.totalCardCount-cardDataElt.frozenCardCount}/${cardDataElt.totalCardCount})`;
    const anchorElt = addChildSvgElement(cardElt, 'a', {'href': href, 'target': '__blank'});
    const image = addChildSvgElement(anchorElt, 'image', {'filter': filter, 'href': src, 'x': 0, 'y': 2, 'width': 84, 'height': 105});
    addText(addChildSvgElement(cardElt, 'text', {'x': 5, 'y': 120, 'width': 86, 'height': 20, 'font-family': 'monospace', 'font-size': '6', 'stroke': 'black', 'fill': 'white', 'pointer-events': 'none'}), cardTitle);
  };
  if ((cardData === undefined) || (!cardData.ready)) {
    accountElt.innerText = '';
    houseAccountElt.innerText = '';
    setAccountCacheBalance('', '');
    houseAccountBalanceElt.innerText = '';
    houseAccountCacheBalanceElt.innerText = '';
    clear(card1Elt);
    clear(card2Elt);
    clear(card3Elt);
    if (cardData === undefined) {
      const scoreText = ['Wax Account Ready, An unknown error occurred server side', 'Please wait 30 seconds past', getDate(), 'For blockchain to update.'];
      setScore(scoreText);
    } else {
      const scoreText = ['Wax Account Ready, An error error occurred server side',
        cardData.errorMessage, 'Please wait 30 seconds past', getDate(), 'For blockchain to update.'];
      setScore(scoreText);
    }
  } else {
    accountElt.innerText = cardData.account;
    houseAccountElt.innerText = cardData.houseAccount;
    houseAccountCacheBalanceElt.innerText = cardData.cacheHouseBalanceDescription;
    if (cardData.houseAccountInfo.error) {
      houseAccountBalanceElt.innerText = cardData.houseAccountInfo.error;
    } else {
      houseAccountBalanceElt.innerText = cardData.houseBalanceDescription;
    }

    let balanceTooltip = `Your Balance: ${cardData.cacheBalanceDescription}`;
    balanceTooltip += '\n';
    balanceTooltip += 'Your Pending Balance:';
    if (cardData.accountInfo.error) {
      balanceTooltip += cardData.accountInfo.error;
    } else {
      balanceTooltip += cardData.balanceDescription;
    }
    setAccountCacheBalance(truncate(cardData.cacheBalanceDecimal) + ' ban', balanceTooltip);

    if ((cardData.cards !== undefined) && (cardData.cards.length == 3)) {
      setCard(card1Elt, cardData.cards[0]);
      setCard(card2Elt, cardData.cards[1]);
      setCard(card3Elt, cardData.cards[2]);
    }
    const scoreText = [];
    if (Array.isArray(cardData.score)) {
      cardData.score.forEach((scoreElt, scoreEltIx) => {
        if (scoreEltIx == 0) {
          if (cardData.scoreError) {
            scoreText.push('Error:' + scoreElt);
          } else {
            scoreText.push('Score:' + scoreElt);
          }
        } else {
          scoreText.push(scoreElt);
        }
      });
    } else {
      if (cardData.scoreError) {
        scoreText.push('Error:' + cardData.score);
      } else {
        scoreText.push('Score:' + cardData.score);
      }
    }
    scoreText.push(`Odds:${cardData.cardCount} of ${cardData.templateCount} Payout:${cardData.payoutAmount}:1`);
    scoreText.push(`Payout Win Multiplier:${cardData.payoutMultiplier}`);
    if (cardData.score[0] == 'Won') {
      winConfetti();
      setScore(scoreText, 'lightgreen', 'green');
    } else {
      setScore(scoreText);
    }
  }
};


const addAttributes = (child, attributes) => {
  if (attributes) {
    Object.keys(attributes).forEach((attibute) => {
      const value = attributes[attibute];
      child.setAttribute(attibute, value);
    });
  }
};

const addChildSvgElement = (parent, childType, attributes) => {
  const child = document.createElementNS('http://www.w3.org/2000/svg', childType);
  parent.appendChild(child);
  addAttributes(child, attributes);
  return child;
};

const addText = (parent, childText) => {
  parent.appendChild(document.createTextNode(childText));
};

const clear = (parent) => {
  while (parent.firstChild) {
    parent.removeChild(parent.firstChild);
  }
};

const setText = (parent, childText) => {
  clear(parent);
  addText(parent, childText);
};

const getSvgSlotMachineElementById = (id) => {
  const slotMachineElt = document.getElementById('slotMachine');
  const contentDocument = slotMachineElt.contentDocument;
  const elt = contentDocument.getElementById(id);
  // console.log('getSvgSlotMachineElementById', id, slotMachineElt, elt);
  return elt;
};

const setScore = (scoreText, fill, stroke) => {
  const scoreElt = getSvgSlotMachineElementById('score');
  clear(scoreElt);


  if ((fill != undefined) && (stroke != undefined)) {
    addChildSvgElement(scoreElt, 'rect', {'x': 107, 'y': 732, 'width': 285, 'height': 70, 'stroke': stroke, 'fill': fill, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '10'});
  }

  let y = 750;

  const addTextElt = (text) => {
    // console.log('addTextElt', text);
    const textElt = addChildSvgElement(scoreElt, 'text', {
      'x': 120, 'y': y, 'font-family': 'monospace', 'font-size': 12, 'stroke': 'black',
      'fill': 'transparent', 'pointer-events': 'none',
    });
    setText(textElt, text);
    y += 10;
  };
  if (Array.isArray(scoreText)) {
    scoreText.forEach((text) => {
      addTextElt(text);
    });
  } else {
    addTextElt(scoreText);
  }
};

const setAccountCacheBalance = (balanceText, balanceTooltip) => {
  const secondAccountCacheBalanceElt = document.querySelector('#accountCacheBalance');

  const accountCacheBalanceElt = getSvgSlotMachineElementById('accountCacheBalance');
  const accountCacheBalanceTooltipElt = getSvgSlotMachineElementById('accountCacheBalanceTooltip');

  setText(secondAccountCacheBalanceElt, balanceText);
  setText(accountCacheBalanceElt, balanceText);
  setText(accountCacheBalanceTooltipElt, balanceTooltip);
};

const withdraw = () => {
  const accountElt = document.querySelector('#withdrawAccount');
  const amountElt = document.querySelector('#withdrawAmount');
  const withdrawButtonElt = document.querySelector('#withdrawButton');
  const withdrawResponseElt = document.querySelector('#withdrawResponse');

  const xmlhttp = new XMLHttpRequest();
  const parms = {};
  parms.owner = window.localStorage.owner;
  parms.nonce = window.localStorage.nonce;
  parms.account = accountElt.value;
  parms.amount = amountElt.value;

  setScore('pending...');
  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      withdrawButton.disabled = false;
      const response = JSON.parse(this.responseText);
      console.log('withdraw', response);
      setScore(response.message);
      withdrawResponseElt.innerText = response.message;
      if (response.success) {
        play();
      }
    }
  };
  withdrawResponseElt.innerText = '';
  xmlhttp.open('POST', '/withdraw', true);
  xmlhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xmlhttp.send(JSON.stringify(parms));
  withdrawButton.disabled = true;
};
window.withdraw = withdraw;

window.submitHcaptcha = () => {
  const hcaptchaElts = [...document.getElementsByName('h-captcha-response')];
  const hcaptchaElt = hcaptchaElts[0];
  const xmlhttp = new XMLHttpRequest();
  const parms = {};
  parms['h-captcha-response'] = hcaptchaElt.value;
  parms.owner = window.localStorage.owner;
  parms.nonce = window.localStorage.nonce;
  setScore('pending...');

  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const response = JSON.parse(this.responseText);
      setScore(response.message);
      if (response.success) {
        hcaptcha.reset();
        play();
      }
    }
  };
  xmlhttp.open('POST', '/hcaptcha', true);
  xmlhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xmlhttp.send(JSON.stringify(parms));
};

window.showSlotMachine = () => {
  document.querySelector('#additionlDetailsButton').disabled = false;
  document.querySelector('#slotMachineButton').disabled = true;
  document.querySelector('#additionlDetailsTable').className = 'display_none';
  document.querySelector('#slotMachineTable').className = 'w100pct';
};

window.showAdditionalDetails = () => {
  document.querySelector('#additionlDetailsButton').disabled = true;
  document.querySelector('#slotMachineButton').disabled = false;
  document.querySelector('#additionlDetailsTable').className = 'w100pct';
  document.querySelector('#slotMachineTable').className = 'display_none';
};

const winConfetti = () => {
  const count = 200;
  const defaults = {
    origin: {y: 0.7},
  };

  function fire(particleRatio, opts) {
    confetti(Object.assign({}, defaults, opts, {
      particleCount: Math.floor(count * particleRatio),
    }));
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
};
