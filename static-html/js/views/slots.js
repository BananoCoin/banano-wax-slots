import {waxjs} from '../../js-lib/waxjs-0.0.14.js';
import {blake2bInit, blake2bUpdate, blake2bFinal} from '../../js-lib/blake2b.js';
import {bananojs} from '../../js-lib/bananocoin-bananojs-2.2.2.js';
import {getDate} from '../../js-lib/date-util.js';

const wax = new waxjs.WaxJS('https://wax.greymass.com', null, null, false);

let owner;
let cardData;
let walletKind;

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

  const betElt = document.querySelector('input[name=\'bet\']:checked');
  if (bet) {
    parms.bet = parseInt(betElt.value,10);
  }
  const scoreElt = document.querySelector('#score');

  scoreElt.innerText = 'pending...';
  setAllTopTo(`<span class="rounded small">pending...</span>`);

  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      cardData = JSON.parse(this.responseText);
      console.log('cardData', cardData);
      document.querySelector('#play').disabled = false;
      const scoreElt = document.querySelector('#score');
      scoreElt.innerText = 'Ready to begin. Press Play!';
      addCards();
      stopSounds();
      if (cardData.score == 'Lost') {
        startSound('loser');
      }
      if (cardData.score == 'Won') {
        startSound('winner');
        startSound('money');
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
  const scoreElt = document.querySelector('#score');
  const ownerActions = await wax.rpc.history_get_actions(owner, -1, -2);
  const ownerAction = ownerActions.actions[0];
  const lastNonce = ownerAction.action_trace.act.data.assoc_id;
  lastNonceElt.innerText = lastNonce;
  scoreElt.innerText = '';
  addCards();
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

window.onLoad = async () => {
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
    ownerElt.innerHTML = `<span class="rounded">${owner}</span>`;
  } else {
    ownerElt.innerHTML = `<span class="rounded">&nbsp;</span>`;
  }
  const nonce = window.localStorage.nonce;

  if (nonce !== undefined) {
    nonceElt.innerText = nonce;
  } else {
    nonceElt.innerText = '';
  }
  setAllTopTo('');

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
        ownerElt.innerHTML = `<span class="rounded">${owner}</span>`;

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
        const scoreElt = document.querySelector('#score');
        const scoreHtml = `Please wait 30 seconds past <span class="monospace">${getDate()}</span> for blockchain to update before trying again.`;
        scoreElt.innerHTML = scoreHtml;
        setTimeout(getLastNonceAndAddTemplates, 5000);
      } catch (error) {
        console.log('error', error.message);
        ownerElt.innerHTML = `<span class="rounded">${error.message}</span>`;
      }
    };


    async function autoLogin() {
      const isAutoLoginAvailable = await wax.isAutoLoginAvailable();
      if (isAutoLoginAvailable) {
        const userAccount = wax.userAccount;
        owner = userAccount;
        window.localStorage.owner = owner;
        ownerElt.innerHTML = `<span class="rounded">${owner}</span>`;
        setTimeout(nonceTx, 0);
      } else {
        ownerElt.innerHTML = `<span class="rounded">Not auto-logged in</span>`;
        login();
      }
    }

    async function login() {
      try {
        const userAccount = await wax.login();
        owner = userAccount;
        window.localStorage.owner = owner;
        ownerElt.innerHTML = `<span class="rounded">${owner}</span>`;
        setTimeout(nonceTx, 0);
      } catch (e) {
        console.log(e.message);
        ownerElt.innerHTML = `<span class="rounded">${e.message}</span>`;
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
        const scoreElt = document.querySelector('#score');
        const scoreHtml = `Please wait 30 seconds past <span class="monospace">${getDate()}</span> for blockchain to update before trying again.`;
        scoreElt.innerHTML = scoreHtml;
        setTimeout(getLastNonceAndAddTemplates, 5000);
      } catch (e) {
        document.getElementById('transaction_id').innerHTML = e.message;
      }
    };
  } catch (e) {
    console.log(e.message);
    document.getElementById('owner').innerHTML = `<span class="rounded">${e.message}</span>`;
  }
};

const setAllTopTo = (logInHtml) => {
  document.getElementById('account').innerHTML = logInHtml;
  document.getElementById('accountBalance').innerHTML = logInHtml;
  document.getElementById('accountCacheBalance').innerHTML = logInHtml;
  document.getElementById('houseAccountBalance').innerHTML = logInHtml;
  document.getElementById('houseAccountCacheBalance').innerHTML = logInHtml;
};

const addCards = async () => {
  const lastNonceHashElt = document.querySelector('#lastNonceHash');
  const nonceHashElt = document.querySelector('#nonceHash');

  const scoreElt = document.querySelector('#score');
  if (lastNonceHashElt.innerText != nonceHashElt.innerText) {
    scoreElt.innerHTML = '<span class="bg_pink rounded">Need to log in again, local nonce hash has does not match blockchain nonce hash.</span>';
    const logInHtml = '<span class="bg_pink rounded">Log In</span>';
    document.getElementById('owner').innerHTML = logInHtml;
    setAllTopTo(logInHtml);
    return;
  }
  const accountElt = document.querySelector('#account');
  const houseAccountElt = document.querySelector('#houseAccount');
  const accountBalanceElt = document.querySelector('#accountBalance');
  const accountCacheBalanceElt = document.querySelector('#accountCacheBalance');
  const houseAccountBalanceElt = document.querySelector('#houseAccountBalance');
  const houseAccountCacheBalanceElt = document.querySelector('#houseAccountCacheBalance');

  const card1Elt = document.querySelector('#card1');
  const card2Elt = document.querySelector('#card2');
  const card3Elt = document.querySelector('#card3');
  const setCard = (cardElt, cardDataElt) => {
    let innerHTML = '';
    let border = '';
    if (cardDataElt.frozen) {
      border = 'border-width:0.2vh;border-color:blue;background-color:lightblue;';
    } else if (cardData.score == 'Won') {
      border = 'border-width:0.2vh;border-color:green;background-color:lightblue;';
    } else {
      border = 'border-width:0.2vh;border-color:black;background-color:white;';
    }
    innerHTML += `<span class="bordered" style="${border}">`;
    let filter = '';
    if (cardDataElt.grayscale) {
      filter = 'filter: grayscale(100%);';
    }
    innerHTML += `<a target="_blank" href="https://wax.atomichub.io/market?collection_name=crptomonkeys&match=${encodeURIComponent(cardDataElt.name)}&order=asc&sort=price&symbol=WAX">`;
    innerHTML += `<img style="width:100%;height:auto;${filter}" src="/ipfs/${cardDataElt.ipfs}.webp">`;
    innerHTML += '</a>';
    innerHTML += '<br>';
    innerHTML += `<span>${cardDataElt.name}</span>`;
    innerHTML += `</span>`;
    // innerHTML += `</br>`;
    cardElt.innerHTML = innerHTML;
  };
  if ((cardData === undefined) || (!cardData.ready)) {
    accountElt.innerText = '';
    houseAccountElt.innerText = '';
    accountBalanceElt.innerText = '';
    accountCacheBalanceElt.innerText = '';
    houseAccountBalanceElt.innerText = '';
    houseAccountCacheBalanceElt.innerText = '';
    card1Elt.innerHTML = '';
    card2Elt.innerHTML = '';
    card3Elt.innerHTML = '';
    if (cardData === undefined) {
      const scoreHtml = `<span class="bg_pink">Wax Account Ready, An unknown error occurred server side.<br>Please wait 30 seconds past <span class="monospace">${getDate()}</span> before trying again.</span>`;
      scoreElt.innerHTML = scoreHtml;
    } else {
      const scoreHtml = `<span class="bg_pink">Wax Account Ready, An error occurred server side ${cardData.errorMessage}.<br>Please wait 30 seconds past <span class="monospace">${getDate()}</span> before trying again.</span>`;
      scoreElt.innerHTML = scoreHtml;
    }
  } else {
    accountElt.innerText = cardData.account;
    houseAccountElt.innerText = cardData.houseAccount;
    accountCacheBalanceElt.innerText = cardData.cacheBalanceDescription;
    houseAccountCacheBalanceElt.innerText = cardData.cacheHouseBalanceDescription;
    if (cardData.houseAccountInfo.error) {
      houseAccountBalanceElt.innerText = cardData.houseAccountInfo.error;
    } else {
      houseAccountBalanceElt.innerText = cardData.houseBalanceDescription;
    }
    if (cardData.accountInfo.error) {
      accountBalanceElt.innerText = cardData.accountInfo.error;
    } else {
      accountBalanceElt.innerText = cardData.balanceDescription;
    }
    if ((cardData.cards !== undefined) && (cardData.cards.length == 3)) {
      setCard(card1Elt, cardData.cards[0]);
      setCard(card2Elt, cardData.cards[1]);
      setCard(card3Elt, cardData.cards[2]);
    }
    if (cardData.scoreError) {
      const html = `<span class="bg_pink">Score:${cardData.score} <br>Odds:${cardData.cardCount} of ${cardData.templateCount} Payout:${cardData.payoutOdds}:1 Payout Win Multiplier:${cardData.payoutMultiplier}</span>`;
      scoreElt.innerHTML = html;
    } else {
      const html = `Score:${cardData.score} <br>Odds:${cardData.cardCount} of ${cardData.templateCount} Payout:${cardData.payoutOdds}:1 Payout Win Multiplier:${cardData.payoutMultiplier}`;
      scoreElt.innerHTML = html;
    }
  }
};

const withdraw = () => {
  const scoreElt = document.querySelector('#score');
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

  scoreElt.innerText = 'pending...';
  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      withdrawButton.disabled = false;
      const response = JSON.parse(this.responseText);
      console.log('withdraw', response);
      scoreElt.innerText = response.message;
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
  const scoreElt = document.querySelector('#score');
  scoreElt.innerText = 'pending...';

  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const response = JSON.parse(this.responseText);
      scoreElt.innerText = response.message;
      console.log('hcaptcha', response);
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
