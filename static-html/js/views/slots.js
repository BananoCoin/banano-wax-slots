import {waxjs} from '../../js-lib/waxjs-0.0.14.js';
import {blake2bInit, blake2bUpdate, blake2bFinal} from '../../js-lib/blake2b.js';
import {bananojs} from '../../js-lib/bananocoin-bananojs-2.2.2.js';
import {getDate} from '../../js-lib/date-util.js';

const blurSize = '0.5vmin';
const CHAIN_NOT_LOADED = 'Not Loaded';
const LOAD_ALL_ENDPOINTS = false;

let tryNumber = 0;
const maxTryNumber = 2;
let owner;
let cardData;
let walletKind;
let betFromSvgId = '1ban';
let betFromSvg = 0;
let spinMonKeysFlag = false;
let spinMonkeysIx = 0;
let waxEndpoint;
let stopWinConfetti = true;
let chainTimestamp = CHAIN_NOT_LOADED;
let goodOdds = false;
let betExpectedValue = undefined;
let isSoundPlaying = false;
const checkEndpointsFns = [];

const sounds = ['start', 'wheel', 'winner', 'loser', 'money'];

const startSound = (id) => {
  if (window.localStorage.soundOn !== 'true') {
    return;
  }
  isSoundPlaying = false;
  document.getElementById(id).play().then(()=> {
    isSoundPlaying = true;
  });
};

const stopSounds = () => {
  if (isSoundPlaying) {
    for (let ix = 0; ix < sounds.length; ix++) {
      const id = sounds[ix];
      document.getElementById(id).pause();
      document.getElementById(id).currentTime = 0;
    }
  }
};

window.waxjsWallet = async () => {
  if (cardData !== undefined) {
    if (cardData.underMaintenance) {
      alert('under maintenance');
      return;
    }
  }
  window.localStorage.nonce_kind = 'wax';
  walletKind = 'waxjs';
  resetNonceAndOwner();
};

window.anchorWallet = async () => {
  if (cardData !== undefined) {
    if (cardData.underMaintenance) {
      alert('under maintenance');
      return;
    }
  }
  window.localStorage.nonce_kind = 'wax';
  walletKind = 'anchor';
  resetNonceAndOwner();
};

window.cryptomonkeyConnectWallet = async () => {
  window.localStorage.nonce = getRandomHex32();
  window.localStorage.nonce_kind = 'cmc';
  const authUrl = document.querySelector('#authUrl').innerText;
  const clientId = document.querySelector('#clientId').innerText;
  let redirectUrl = window.location.protocol + '//' + window.location.hostname;
  if (window.location.port) {
    redirectUrl += ':' + window.location.port;
  }
  redirectUrl += '/oauth/monkeyconnect/callback';
  const url = `${authUrl}?response_type=code&client_id=${clientId}&scope=name&state=${window.localStorage.nonce}&redirect_uri=${redirectUrl}`;
  console.log('url', url);
  document.location = url;
};

const getRandomHex32 = () => {
  const array = new Uint32Array(32);
  window.crypto.getRandomValues(array);
  const hex = getByteArrayAsHexString(array);
  return hex;
};

const getByteArrayAsHexString = (byteArray) => {
  return Array.prototype.map.call(byteArray, (byte) => {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
};

window.resetNonceAndOwner = async () => {
  delete window.localStorage.nonceTimestamp;
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
  parms.nonce_kind = window.localStorage.nonce_kind;
  if (window.localStorage.referredBy !== undefined) {
    parms.referred_by = window.localStorage.referredBy;
  }
  // console.log('play', parms);

  if (bet) {
    parms.bet = betFromSvg;
  }
  setScore('pending...');
  setAllTopToClass('small', 'pending...');
  if (bet) {
    setArm('smclick');
    spinMonKeysFlag = true;
    setTimeout(spinMonKeys, 0);
  }

  if (window.localStorage.owner !== undefined) {
    const ownerElt = document.querySelector('#owner');
    ownerElt.innerHTML = `<span>${owner}</span>`;
  }

  xmlhttp.timeout = 60000;
  xmlhttp.ontimeout = function() {
    cardData = {
      intermittentError: true,
      ready: false,
      errorMessage: `Server Timeout`,
    };
    document.querySelector('#play').disabled = false;
    setArm('smrest');
    spinMonKeysFlag = false;
  };
  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4) {
      if (this.status == 200) {
        cardData = JSON.parse(this.responseText);
        // console.log('cardData', cardData);
      } else {
        cardData = {
          ready: false,
          intermittentError: true,
          errorMessage: `${this.status}:${this.statusText}`,
        };
      }
      document.querySelector('#play').disabled = false;
      setArm('smrest');
      spinMonKeysFlag = false;
      setScore('Ready to begin. Press Play!', 'lightgreen', 'green');
      addCards();
      stopSounds();
      stopWinConfetti = true;
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
    stopWinConfetti = true;
    if (window.localStorage.owner !== undefined) {
      startSound('start');
      startSound('wheel');
    }
  }
  xmlhttp.open('POST', '/play', true);
  xmlhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xmlhttp.send(JSON.stringify(parms));
  document.querySelector('#play').disabled = true;
  if (window.localStorage.autoplayOn == 'true') {
    const autoplayCycleTime = parseInt(document.querySelector('#autoplayCycleTime').innerText);
    if (autoplayCycleTime > 0) {
      setTimeout(autoplay, autoplayCycleTime);
    }
  }
};

const autoplay = () => {
  if (window.localStorage.autoplayOn == 'true') {
    if (cardData === undefined) {
      // console.log('autoplay SKIPPED');
    } else {
      // console.log('autoplay STARTED', 'cardData.scoreError', cardData.scoreError);
      if (cardData.scoreError) {
        window.localStorage.autoplayOn == 'false';
      } else {
        const betButtons = [
          '50ban', '10ban', '5ban', '1ban',
        ];
        synchBetButtons(betButtons[0]);
        // console.log('autoplay', 'expectedValue', 0, betButtons[0], betExpectedValue);
        let bestExpectedValue = betExpectedValue;
        let bestBetButton = betButtons[0];
        for (let betButtonIx = 1; betButtonIx < betButtons.length; betButtonIx++) {
          const betButton = betButtons[betButtonIx];
          synchBetButtons(betButton);
          // console.log('autoplay', 'expectedValue', betButtonIx, betButton, betExpectedValue);
          if (betExpectedValue !== undefined) {
            if ((betExpectedValue > bestExpectedValue) ||
             (bestExpectedValue == undefined)) {
              bestExpectedValue = betExpectedValue;
              bestBetButton = betButton;
            }
          }
        }
        synchBetButtons(bestBetButton);
        if (goodOdds) {
          window.play();
        } else {
          window.localStorage.autoplayOn == 'false';
        // synchAutoplay();
        }
      }
      // console.log('autoplay SUCCESS');
    }
  }
};

window.play = () => {
  play(true);
};

window.checkEndpoints = () => {
  checkEndpointsFns.forEach((checkEndpointsFn) => {
    checkEndpointsFn();
  });
};

window.addWaxEndpoints = async () => {
  const waxEndpointsJsonElt = document.querySelector('#waxEndpointsJson');
  const waxEndpointsJsonTxt = waxEndpointsJsonElt.innerText;
  const waxEndpointsJson = JSON.parse(waxEndpointsJsonTxt);
  let html = '';
  checkEndpointsFns.length = 0;

  if (LOAD_ALL_ENDPOINTS) {
    const endpointsUrl = 'https://validate.eosnation.io/wax/reports/endpoints.json';
    const res = await fetch(endpointsUrl, {
      method: 'get',
      headers: {'Content-Type': 'application/json'},
    });
    const text = await res.text();
    const json = JSON.parse(text);
    const report = json.report;
    const api_https2 = report.api_https2;
    api_https2.forEach((api_https2_elt) => {
      const waxEndpoint = api_https2_elt[1];
      if (waxEndpointsJson.indexOf(waxEndpoint) == -1) {
        console.log('api_https2', 'waxEndpoint', waxEndpoint);
        waxEndpointsJson.push(waxEndpoint);
      }
    });
  }

  waxEndpointsJson.forEach((waxEndpoint, waxEndpointIx) => {
    const href = `${waxEndpoint}/v2/history/get_actions?act.name=requestrand&account=${owner}&limit=1`;
    const id = `waxEndpoint_${waxEndpointIx}`;
    html += `<a href="${href}" target="_blank"></a>`;
    html += `<h5>${waxEndpoint}</h5>`;
    html += `<div id="${id}"></div>`;
    html += '<hr>';
    const fetchFn = async () => {
      const fetchElt = document.querySelector(`#${id}`);
      try {
        const res = await fetch(href, {
          method: 'get',
          headers: {'Content-Type': 'application/json'},
        });
        if (res.status !== 200) {
          fetchElt.innerText = `url:'${waxEndpoint}' status:'${res.status}' statusText:'${res.statusText}'`;
        } else {
          const text = await res.text();
          // console.log('text',text)
          const json = JSON.parse(text);
          if (json.actions !== undefined) {
            fetchElt.innerText= 'number of actions ' + json.actions.length;
          } else {
            fetchElt.innerText= 'actions is undefined';
          }
        }
      } catch (error) {
        console.trace(error);
        fetchElt.innerText = error.message;
      }
    };
    checkEndpointsFns.push(fetchFn);
  });
  const waxEndpointsElt = document.querySelector('#waxEndpoints');
  waxEndpointsElt.innerHTML = html;
};

window.getLastNonce = async () => {
  const overrideNonceElt = document.querySelector('#overrideNonce');
  const lastNonceElt = document.querySelector('#lastNonceHash');
  const nonceHashElt = document.querySelector('#nonceHash');
  if (overrideNonceElt.innerText == 'true') {
    lastNonceElt.innerText = nonceHashElt.innerText;
    return;
  }

  if (window.localStorage.nonce_kind == 'cmc') {
    const res = await fetch('/cmc_nonce_hash?owner=' + owner, {
      method: 'get',
      headers: {'Content-Type': 'application/json'},
    });
    const text = await res.text();
    lastNonceElt.innerText = text;
  }
  if (window.localStorage.nonce_kind == 'wax') {
    const waxEndpointVersionElt = document.querySelector('#waxEndpointVersion');
    const waxEndpointVersion = waxEndpointVersionElt.innerText;
    if (waxEndpointVersion == 'v1') {
      const ownerActions = await waxEndpoint.rpc.history_get_actions(owner, -1, -2);
      const ownerAction = ownerActions.actions[0];
      const lastNonce = ownerAction.action_trace.act.data.assoc_id;
      // console.log(ownerAction);
      lastNonceElt.innerText = lastNonce;
    }
    if (waxEndpointVersion == 'v2' || waxEndpointVersion == 'v2proxy') {
      const waxEndpointElt = document.querySelector('#waxEndpoint');
      let urlBase = waxEndpointElt.innerText;
      if (urlBase.length == 0) {
        urlBase = window.location.href;
        if (urlBase.endsWith('/')) {
          urlBase = urlBase.substring(0, urlBase.length-1);
        }
      }
      const urlStr = '/v2/history/get_actions';
      console.log('history_get_actions', 'urlBase', urlBase);
      // console.log('history_get_actions', 'urlStr', urlStr);
      const url = new URL(urlStr, urlBase);
      url.searchParams.append('act.name', 'requestrand');
      // url.searchParams.append('act.data.assoc_id', nonceHashElt.innerText);
      url.searchParams.append('account', owner);
      url.searchParams.append('skip', 0);
      url.searchParams.append('limit', 10);
      url.searchParams.append('simple', false);
      // console.log('history_get_actions', 'url', url);
      fetch(url, {
        method: 'get',
        headers: {'Content-Type': 'application/json'},
      })
          .catch((err) => {
            console.log('history_get_actions', 'err', err);
            setScore([err.message]);
          })
          .then((res) => res.json())
          .catch((err) => {
            console.log('history_get_actions', 'err', err);
            setScore([err.message]);
          })
          .then((json) => {
            if (json == undefined) {
              const score = [];
              score.push('json == undefined');
              setScore(score);
              return;
            }
            if (json.error) {
              const score = [];
              score.push(json.error);
              if (json.message) {
                score.push(json.message);
              }
              setScore(score);
              return;
            }
            chainTimestamp = '';
            console.log('history_get_actions', 'json', json);
            if (json.actions !== undefined) {
              let lastNonce;
              // console.log('history_get_actions', 'json', json);
              if (json.actions.length > 0) {
                if (json.actions[0].act !== undefined) {
                  chainTimestamp = json.actions[0].timestamp;
                  lastNonce = json.actions[0].act.data.assoc_id;
                }
              } else {
                chainTimestamp = 'Unknown';
              }
              json.actions.forEach((action) => {
                if (action.act.data.assoc_id == nonceHashElt.innerText) {
                  chainTimestamp = action.timestamp;
                  lastNonce = action.act.data.assoc_id;
                }
              });
              const tIx = chainTimestamp.indexOf('T');
              if (tIx != -1) {
                chainTimestamp = chainTimestamp.substring(0, tIx);
              }
              // console.log('history_get_actions', 'lastNonce', lastNonce);
              // console.log('history_get_actions', 'nonceHashElt.innerText', nonceHashElt.innerText);
              lastNonceElt.innerText = lastNonce;
            }
          });
    }
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
    if (idAmounts !== undefined) {
      const ids = Object.keys(idAmounts);
      ids.forEach((id) => {
        getSvgSlotMachineElementById(id).setAttribute('fill', 'yellow');
        getSvgSlotMachineElementById(id).setAttribute('stroke', 'black');
        const textElt = getSvgSlotMachineElementById(id+'-text');
        const text = parseFloat(idAmounts[id]).toFixed(4);
        // console.log('synchBetButtons', textElt, text);
        textElt.textContent = text;
      });
      betFromSvg = idAmounts[selectedId];
      getSvgSlotMachineElementById(selectedId).setAttribute('fill', 'cyan');
      getSvgSlotMachineElementById(selectedId).setAttribute('stroke', 'black');
    }
  }
  resetScoreText();
};

const spinMonkey = (cardElt, ownedAsset) => {
  clear(cardElt);
  cardElt.setAttribute('class', 'bordered');
  if (ownedAsset.frozen) {
    addChildSvgElement(cardElt, 'rect', {'x': 0, 'y': 0, 'width': 86, 'height': 125, 'fill': 'lightblue', 'stroke': 'blue'});
  } else {
    addChildSvgElement(cardElt, 'rect', {'x': 0, 'y': 0, 'width': 86, 'height': 125, 'fill': 'white', 'stroke': 'black'});
  }
  const cardTitle = `${ownedAsset.name}`;
  const src = `/ipfs/${ownedAsset.img}.webp`;
  const image = addChildSvgElement(cardElt, 'image', {'filter': 'url(#grayscale) url(#blur)', 'href': src, 'x': 0, 'y': 2, 'width': 84, 'height': 105});
  addText(addChildSvgElement(cardElt, 'text', {'x': 5, 'y': 120, 'width': 86, 'height': 20, 'font-family': 'monospace', 'font-size': '6', 'stroke': 'black', 'fill': 'white', 'pointer-events': 'none'}), cardTitle);
};

const spinMonKeys = () => {
  if (cardData == undefined) {
    return;
  }
  if (cardData.ownedAssets == undefined) {
    return;
  }
  if (cardData.ownedAssets.length == 0) {
    return;
  }
  const card1Elt = getSvgSlotMachineElementById('card1');
  const card2Elt = getSvgSlotMachineElementById('card2');
  const card3Elt = getSvgSlotMachineElementById('card3');

  if (spinMonKeysFlag) {
    const increment = () => {
      spinMonkeysIx++;
      if (spinMonkeysIx >= cardData.ownedAssets.length) {
        spinMonkeysIx = 0;
      }
    };

    increment();
    spinMonkey(card1Elt, cardData.ownedAssets[spinMonkeysIx]);
    increment();
    spinMonkey(card2Elt, cardData.ownedAssets[spinMonkeysIx]);
    increment();
    spinMonkey(card3Elt, cardData.ownedAssets[spinMonkeysIx]);
    setTimeout(spinMonKeys, 50);
  }
};

const clearMonkeys = () => {
  const card1Elt = getSvgSlotMachineElementById('card1');
  const card2Elt = getSvgSlotMachineElementById('card2');
  const card3Elt = getSvgSlotMachineElementById('card3');

  clear(card1Elt);
  clear(card2Elt);
  clear(card3Elt);
};

const setArm = (id) => {
  spinMonKeysFlag = id == 'smmouse';
  setTimeout(spinMonKeys, 0);
  const smrestElt = getSvgSlotMachineElementById('smrest');
  const smmouseElt = getSvgSlotMachineElementById('smmouse');
  const smclickElt = getSvgSlotMachineElementById('smclick');
  const elt = getSvgSlotMachineElementById(id);
  smrestElt.setAttribute('visibility', 'hidden');
  smmouseElt.setAttribute('visibility', 'hidden');
  smclickElt.setAttribute('visibility', 'hidden');
  elt.setAttribute('visibility', 'visible');
};

const addPlayArmListeners = (id) => {
  const elt = getSvgSlotMachineElementById(id);
  elt.addEventListener('click', () => {
    if (document.querySelector('#play').disabled) {
      return false;
    }
    if (spinMonKeysFlag) {
      spinMonKeysFlag = false;
      clearMonkeys();
    }
    window.play();
    return false;
  });
  elt.addEventListener('mouseleave', () => {
    setArm('smrest');
    if (spinMonKeysFlag) {
      spinMonKeysFlag = false;
      clearMonkeys();
    }
  });
  elt.addEventListener('mouseenter', () => {
    setArm('smmouse');
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

window.reload = () => {
  location.reload();
};

const synchAutoplay = () => {
  console.log('synchAutoplay old', window.localStorage.autoplayOn);
  const autoplayElt = document.querySelector('#autoplay');
  if (window.localStorage.autoplayOn == 'true') {
    autoplayElt.innerText = 'Autoplay On';
  } else if (window.localStorage.autoplayOn == 'false') {
    autoplayElt.innerText = 'Autoplay Off';
  } else {
    window.localStorage.autoplayOn = 'true';
    autoplayElt.innerText = 'Autoplay On';
  }
  console.log('synchAutoplay new', window.localStorage.autoplayOn);

  if (window.localStorage.autoplayOn == 'true') {
    autoplay();
  }
};

const synchSound = () => {
  console.log('synchSound old', window.localStorage.soundOn);
  const soundElt = document.querySelector('#sound');
  if (window.localStorage.soundOn == 'true') {
    soundElt.innerText = 'Sound On';
  } else if (window.localStorage.soundOn == 'false') {
    soundElt.innerText = 'Sound Off';
  } else {
    window.localStorage.soundOn = 'true';
    soundElt.innerText = 'Sound On';
  }
  console.log('synchSound new', window.localStorage.soundOn);
};

window.toggleSound = () => {
  console.log('toggleSound old', window.localStorage.soundOn);
  if (window.localStorage.soundOn == 'true') {
    window.localStorage.soundOn = 'false';
  } else {
    window.localStorage.soundOn = 'true';
  }
  console.log('toggleSound new', window.localStorage.soundOn);
  synchSound();
};

window.toggleAutoplay = () => {
  console.log('autoplayOn old', window.localStorage.autoplayOn);
  if (window.localStorage.autoplayOn == 'true') {
    window.localStorage.autoplayOn = 'false';
  } else {
    window.localStorage.autoplayOn = 'true';
  }
  console.log('autoplayOn new', window.localStorage.autoplayOn);
  synchAutoplay();
};


window.debug = () => {
  const scoreText = [];
  scoreText.push(`owner:${window.localStorage.owner}`);
  scoreText.push(`nonce.length:${window.localStorage.nonce.length}`);
  scoreText.push(`endpoint:${waxEndpoint.rpc.endpoint}`);
  scoreText.push(`clientTimestamp:${window.localStorage.nonceTimestamp}`);
  scoreText.push(`chainTimestamp:${chainTimestamp}`);
  const nonceHashElt = document.querySelector('#nonceHash');
  scoreText.push(`clientNonceHash:${nonceHashElt.innerText}`);
  const lastNonceElt = document.querySelector('#lastNonceHash');
  scoreText.push(`chainNonceHash:${lastNonceElt.innerText}`);
  scoreText.push(`matchNonceHash:${lastNonceElt.innerText == nonceHashElt.innerText}`);

  let addVerificationParagraph = false;
  if (chainTimestamp == '') {
    scoreText.push('Reccomendation:chainTimestamp blank, click reload button.');
    addVerificationParagraph = true;
  }
  if (window.localStorage.nonceTimestamp == undefined) {
    scoreText.push('Reccomendation:clientTimestamp blank.');
    scoreText.push('click login button. Login only once. If login fails, click debug button.');
    addVerificationParagraph = true;
  }
  if ((chainTimestamp !== '') &&
    (window.localStorage.nonceTimestamp !== undefined) &&
    (lastNonceElt.innerText !== nonceHashElt.innerText)) {
    addVerificationParagraph = true;
    scoreText.push('Reccomendation:Time Stamps are unequal.');
    scoreText.push('click login button. Login only once. If login fails, click debug button.');
  }
  if (addVerificationParagraph) {
    scoreText.push('Verify securerand exists on wax chain. Go to:');
    scoreText.push(`https://wax.bloks.io/account/${window.localStorage.owner}`);
    scoreText.push('and search for a transaction orng.wax requestrand.');
  } else {
    scoreText.push('No errors detected.');
    scoreText.push('No idea what went wrong. Maybe ask in discord.');
  }

  setScore(scoreText);
};

window.onLoad = async () => {
  if (window.location.hash) {
    console.log('window.location.hash', window.location.hash);
    if (window.location.hash.startsWith('#faq-')) {
      window.showFAQ();
    }
  }
  const searchParams = (new URL(document.location)).searchParams;

  const numSearchParams = Array.from(searchParams).length;
  console.log('searchParams', searchParams, numSearchParams);
  if (numSearchParams > 0) {
    if (searchParams.has('owner')) {
      const searchParamsOwner = searchParams.get('owner');
      console.log('searchParams.owner', searchParamsOwner);
      window.localStorage.owner = searchParamsOwner;
    }
    if (searchParams.has('referredBy')) {
      const searchParamsReferredBy = searchParams.get('referredBy');
      console.log('searchParams.referredBy', searchParamsReferredBy);
      if (searchParamsReferredBy == '') {
        delete window.localStorage.referredBy;
      } else {
        window.localStorage.referredBy = searchParamsReferredBy;
      }
    }
    if (searchParams.has('nonce')) {
      const searchParamsNonce = searchParams.get('nonce');
      console.log('searchParams.nonce', searchParamsNonce);
      window.localStorage.nonce = searchParamsNonce;

      let nonceTimestamp = getDate();
      const tIx = nonceTimestamp.indexOf(' ');
      if (tIx != -1) {
        nonceTimestamp = nonceTimestamp.substring(0, tIx);
      }
      window.localStorage.nonceTimestamp = nonceTimestamp;
    }
    if (searchParams.has('nonce_kind')) {
      const searchParamsNonceKind = searchParams.get('nonce_kind');
      console.log('searchParams.nonce_kind', searchParamsNonceKind);
      window.localStorage.nonce_kind = searchParamsNonceKind;
    }
    window.location.href = window.location.pathname;
    return;
  }
  synchSound();
  synchAutoplay();

  const waxEndpointElt = document.querySelector('#waxEndpoint');
  let waxEndpointUrl = waxEndpointElt.innerText;
  if (waxEndpointUrl.length == 0) {
    waxEndpointUrl = window.location.href;
    if (waxEndpointUrl.endsWith('/')) {
      waxEndpointUrl = waxEndpointUrl.substring(0, waxEndpointUrl.length-1);
    }
  }
  console.log('waxjs.WaxJS', 'waxEndpointUrl', waxEndpointUrl);
  waxEndpoint = new waxjs.WaxJS(waxEndpointUrl, null, null, false);

  addBetListeners('1ban');
  addBetListeners('5ban');
  addBetListeners('10ban');
  addBetListeners('50ban');
  addPlayArmListeners('playArm');

  const burnAccount = document.querySelector('#burnAccount').innerText;
  // const collection = await api.getCollection("crptomonkeys", false);
  // console.log(collection);
  const ownerElt = document.querySelector('#owner');
  const referredByElt = document.querySelector('#referredBy');
  const nonceKindElt = document.querySelector('#nonceKind');
  const cardElt = document.querySelector('#cards');
  const nonceElt = document.querySelector('#nonce');
  const nonceHashElt = document.querySelector('#nonceHash');
  const lastNonceElt = document.querySelector('#lastNonceHash');
  lastNonceElt.innerHTML = '';

  if (window.localStorage.referredBy !== undefined) {
    referredByElt.innerText = window.localStorage.referredBy;
  } else {
    referredByElt.innerText = '';
  }

  if (window.localStorage.nonce_kind !== undefined) {
    nonceKindElt.innerText = window.localStorage.nonce_kind;
  } else {
    nonceKindElt.innerText = '';
  }
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
  // console.log('nonceHash', nonceHash);

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
      try {
        setScore('');
        addCards();
      } catch (error) {
        setScore('Nonce Error:' + error.message);
      }
      play(false);
    };

    // if owner set, get tempate with owner.
    // otherwise get with burn address, to show 'bad nonce' message.
    getLastNonceAndAddTemplates();

    async function anchorLogin() {
      setAllTopToClass('bg_green', '(1/4) login...');
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
          // broadcast: false,
        });
        console.log('result', result);
        document.getElementById('transaction_id').innerHTML = result.transaction_id;
        const scoreText = ['Please wait 25 seconds past', getDate(), 'For blockchain to update.'];
        setScore(scoreText);
        setTimeout(getLastNonceAndAddTemplates, 25000);
      } catch (error) {
        console.log('error', error.message);
        ownerElt.innerHTML = `<span>${error.message}</span>`;
      }
    };

    async function autoLogin() {
      setAllTopToClass('bg_green', '(1/4) auto login...');
      try {
        const isAutoLoginAvailable = await waxEndpoint.isAutoLoginAvailable();
        if (isAutoLoginAvailable) {
          const userAccount = waxEndpoint.userAccount;
          owner = userAccount;
          window.localStorage.owner = owner;
          ownerElt.innerHTML = `<span>${owner}</span>`;
          setTimeout(nonceTx, 0);
        } else {
          ownerElt.innerHTML = `<span>Not auto-logged in</span>`;
          login();
        }
      } catch (error) {
        console.log('autoLogin error', error.message);
        ownerElt.innerHTML = `<span>${error.message}</span>`;
      }
    }

    async function login() {
      setAllTopToClass('bg_green', '(2/4) login...');
      try {
        const userAccount = await waxEndpoint.login();
        owner = userAccount;
        window.localStorage.owner = owner;
        ownerElt.innerHTML = `<span>${owner}</span>`;
        setTimeout(nonceTx, 0);
      } catch (e) {
        console.log('login error', e.message);
        ownerElt.innerHTML = `<span>${e.message}</span>`;
      }
    }

    const nonceTx = async () => {
      setAllTopToClass('bg_green', '(3/4) nonce tx...');
      try {
        const result = await waxEndpoint.api.transact({
          actions: [{
            account: 'orng.wax',
            name: 'requestrand',
            authorization: [{
              actor: waxEndpoint.userAccount,
              permission: 'active',
            }],
            data: {
              caller: waxEndpoint.userAccount,
              signing_value: nonceHash,
              assoc_id: nonceHash,
            },
          }],
        }, {
          blocksBehind: 3,
          expireSeconds: 30,
          // broadcast: false,
        });
        // console.log('nonceTx', 'waxEndpoint', waxEndpoint);
        // console.log('nonceTx', 'result', result);
        // result.signatures.forEach((signature, signatureIx) => {
        //   waxEndpoint.pubKeys.forEach((pubKey, pubKeyIx) => {
        //     console.log('nonceTx', signatureIx, pubKeyIx, 'signature', signature);
        //     console.log('nonceTx', signatureIx, pubKeyIx, 'pubKey', pubKey);
        //     const data = result.serializedTransaction.map((x) => x.toString(16).padStart(2, '0')).join('');
        //     console.log('nonceTx', signatureIx, pubKeyIx, 'data', data.length, data);
        //     const valid = eosjs_ecc.verify(signature, data, pubKey, 'hex');
        //     console.log('nonceTx', signatureIx, pubKeyIx, 'valid', valid);
        //   });
        // });
        setAllTopToClass('bg_green', '(4/4) blockchain...');
        document.getElementById('transaction_id').innerHTML = result.transaction_id;
        const scoreText = ['Please wait 30 seconds past', getDate(), 'For blockchain to update.'];
        setScore(scoreText);
        setTimeout(getLastNonceAndAddTemplates, 5000);
      } catch (e) {
        console.log('nonceTx', 'error1', e.message);
        setAllTopToClass('bg_red', e.message);
        document.getElementById('transaction_id').innerHTML = e.message;
      }
    };
  } catch (e) {
    console.log('nonceTx', 'error2', e.message);
    document.getElementById('owner').innerHTML = `<span>${e.message}</span>`;
  }

  document.getElementById('manualAssocId').innerText = nonceHash;
  document.getElementById('manualSigningValue').innerText = nonceHash;
  document.getElementById('manualCaller').innerText = owner;
  document.getElementById('manualCallerCheck').innerText = owner;

  addWaxEndpoints();
};

const setAllTopToClass = (classNm, message) => {
  setAllTopTo(`<span class="${classNm}">${message}</span>`, message, message);
};

const setAllTopTo = (logInHtml, accountBalance, accountBalanceTooltip) => {
  // console.trace('setAllTopTo');
  document.getElementById('account').innerHTML = logInHtml;
  setAccountCacheBalance(accountBalance, accountBalanceTooltip);
  document.getElementById('houseAccountBalance').innerHTML = logInHtml;
  document.getElementById('houseAccountCacheBalance').innerHTML = logInHtml;
};

const truncate = (number) => {
  if (number === undefined) {
    return number;
  }
  const ix = number.indexOf('.');
  if (ix < 0) {
    return number;
  }
  return number.substring(0, ix+3);
};

const setEverythingNotGray = () => {
  getSvgSlotMachineElementById('slotmachine').removeAttribute('filter');
  document.getElementsByTagName('body')[0].setAttribute('class', 'disabled_body');
  document.getElementById('play').disabled = '';

  document.getElementById('additionlDetailsButton').disabled = '';
};

const setEverythingGray = () => {
  getSvgSlotMachineElementById('slotmachine').setAttribute('filter', 'url(#grayscale)');
  document.getElementsByTagName('body')[0].setAttribute('class', '');
  document.getElementById('play').disabled = 'disabled';
  document.getElementById('additionlDetailsButton').disabled = 'disabled';
};

const addCards = async () => {
  synchBetButtons(betFromSvgId);
  const lastNonceHashElt = document.querySelector('#lastNonceHash');
  const nonceHashElt = document.querySelector('#nonceHash');

  const scoreElt = document.querySelector('#score');
  setEverythingNotGray();
  if (lastNonceHashElt.innerText != nonceHashElt.innerText) {
    const scoreText = ['Need to log in again.', 'local nonce hash has does not match', 'blockchain nonce hash.'];
    scoreText.push(`local nonce hash:${nonceHashElt.innerText}`);
    scoreText.push(`blockchain nonce hash:${lastNonceHashElt.innerText}`);
    setScore(scoreText);
    const logInHtml = 'Log In';
    document.getElementById('owner').innerHTML = logInHtml;
    console.log('tryNumber', tryNumber, 'maxTryNumber', maxTryNumber);
    if (chainTimestamp == '') {
      setAllTopToClass('color_red', 'No Chain Timestamp, Please reload.');
    } else {
      if (chainTimestamp == CHAIN_NOT_LOADED) {
        setAllTopToClass('bold', 'Please Refresh, API Not Reachable');
      } else {
        if (tryNumber < maxTryNumber) {
          setAllTopToClass('bold', 'Please Log in, API Dt:' + chainTimestamp);
        } else {
          setAllTopToClass('color_red', 'Try Again, Tx Failed, API Dt:' + chainTimestamp);
        }
      }
    }
    console.log('tryNumber++', tryNumber);
    tryNumber++;
    setEverythingGray();
    return;
  }
  const accountElt = document.querySelector('#account');
  const houseAccountElt = document.querySelector('#houseAccount');
  const houseAccountBalanceElt = document.querySelector('#houseAccountBalance');
  const houseAccountCacheBalanceElt = document.querySelector('#houseAccountCacheBalance');

  const accountSeedLinkElt = document.querySelector('#accountSeedLink');
  if (accountSeedLinkElt !== null) {
    accountSeedLinkElt.href =
    `?nonce=${window.localStorage.nonce}&owner=${window.localStorage.owner}&nonce_kind=${window.localStorage.nonce_kind}`;
  }
  const referralLinkElt = document.querySelector('#referralLink');
  referralLinkElt.href = `?referredBy=${window.localStorage.owner}`;

  if (cardData !== undefined) {
    if (cardData.withdrawAccount !== undefined) {
      const withdrawAccountElt = document.querySelector('#withdrawAccount');
      withdrawAccountElt.value = cardData.withdrawAccount;
    }
  }

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
      filter += ` url(#grayscale)`;
    }
    if (cardDataElt.frozen) {
      filter += ` url(#blur)`;
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
    } else {
      addChildSvgElement(cardElt, 'rect', {'x': 0, 'y': 0, 'width': 86, 'height': 125, 'fill': 'white', 'stroke': 'black'});
    }
    const cardTitle = `${cardDataElt.name} (${cardDataElt.totalCardCount-cardDataElt.frozenCardCount}/${cardDataElt.totalCardCount})`;
    const anchorElt = addChildSvgElement(cardElt, 'a', {'href': href, 'target': '__blank'});
    const image = addChildSvgElement(anchorElt, 'image', {'filter': filter, 'href': src, 'x': 0, 'y': 2, 'width': 84, 'height': 105});
    addText(addChildSvgElement(cardElt, 'text', {'x': 5, 'y': 120, 'width': 86, 'height': 20, 'font-family': 'monospace', 'font-size': '6', 'stroke': 'black', 'fill': 'white', 'pointer-events': 'none'}), cardTitle);
  };
  if ((cardData === undefined) || (!cardData.ready)) {
    setEverythingGray();
    accountElt.innerText = '';
    houseAccountElt.innerText = '';
    setAccountCacheBalance('', '');
    houseAccountBalanceElt.innerText = '';
    houseAccountCacheBalanceElt.innerText = '';
    clear(card1Elt);
    clear(card2Elt);
    clear(card3Elt);
    if (cardData === undefined) {
      const scoreText = ['Wax Account Ready', 'Waiting for server.', 'Please wait 30 seconds past', getDate(), 'For server to update.'];
      setScore(scoreText);
    } else {
      const scoreText = ['Wax Account Ready', ' An error occurred server side',
        cardData.errorMessage, 'Please wait 30 seconds past', getDate(), 'For blockchain to update.'];
      setScore(scoreText);
      if (cardData.intermittentError) {
        setEverythingNotGray();
      }
    }
  } else {
    accountElt.innerText = cardData.account;
    houseAccountElt.innerHTML = `<a class="exit_link" href="https://creeper.banano.cc/explorer/account/${cardData.houseAccount}/history" target="_blank">Link to House Account</a>`;
    houseAccountCacheBalanceElt.innerText = truncate(cardData.houseBalanceDecimal) + ' BAN';
    if (cardData.houseAccountInfo.error) {
      houseAccountBalanceElt.innerText = cardData.houseAccountInfo.error;
    } else {
      houseAccountBalanceElt.innerText = truncate(cardData.cacheHouseBalanceDecimal) + ' BAN';
    }

    let balanceTooltip = `Your Balance: ${cardData.cacheBalanceDescription}`;
    balanceTooltip += '\n';
    balanceTooltip += 'Your Pending Balance:';
    if (cardData.accountInfo.error) {
      balanceTooltip += cardData.accountInfo.error;
    } else {
      balanceTooltip += cardData.balanceDescription;
    }
    setAccountCacheBalance(truncate(cardData.cacheBalanceDecimal) + ' BAN', balanceTooltip);

    if ((cardData.cards !== undefined) && (cardData.cards.length == 3)) {
      setCard(card1Elt, cardData.cards[0]);
      setCard(card2Elt, cardData.cards[1]);
      setCard(card3Elt, cardData.cards[2]);
    }
    resetScoreText();

    cardData.ownedAssets.sort((a, b) => {
      if (a.templateId != b.templateId) {
        return b.templateId - a.templateId;
      }
      if (a.frozen != b.frozen) {
        let aFrozen;
        if (a.frozen) {
          aFrozen = 1;
        } else {
          aFrozen = 0;
        }
        let bFrozen;
        if (b.frozen) {
          bFrozen = 1;
        } else {
          bFrozen = 0;
        }
        return bFrozen - aFrozen;
      }
      if (a.assetId != b.assetId) {
        return b.assetId - a.assetId;
      }
    });

    const assetsByTemplateId = {};
    for (let ix = 0; ix < cardData.ownedAssets.length; ix++) {
      const ownedAsset = cardData.ownedAssets[ix];
      if (assetsByTemplateId[ownedAsset.templateId] == undefined) {
        assetsByTemplateId[ownedAsset.templateId] = [];
      }
      assetsByTemplateId[ownedAsset.templateId].push(ownedAsset);
    }
    const templateIds = [...Object.keys(assetsByTemplateId)];
    templateIds.sort((a, b) => {
      const aOwnedAssets = assetsByTemplateId[a];
      const bOwnedAssets = assetsByTemplateId[b];
      const maxSupplyDiff = bOwnedAssets[0].maxSupply - aOwnedAssets[0].maxSupply;
      if (maxSupplyDiff !== 0) {
        return maxSupplyDiff;
      }

      return aOwnedAssets.length - bOwnedAssets.length;
    });

    let ownedAssetsTemplatesHtml = '';
    for (let ix = 0; ix < templateIds.length; ix++) {
      const templateId = templateIds[ix];
      const ownedAssets = assetsByTemplateId[templateId];
      ownedAssetsTemplatesHtml += getOwnedAssetTemplateHtml(templateId, ownedAssets);
    }

    document.getElementById('ownedAssetsTemplatesInner').innerHTML = ownedAssetsTemplatesHtml;

    let ownedAssetsHtml = '';
    for (let ix = 0; ix < cardData.ownedAssets.length; ix++) {
      const ownedAsset = cardData.ownedAssets[ix];
      ownedAssetsHtml += getOwnedAssetHtml(ownedAsset);
    }

    document.getElementById('ownedAssetsInner').innerHTML = ownedAssetsHtml;

    const frozenHistogramHtml = getFrozenHistogramHtml(cardData.ownedAssets);

    document.getElementById('frozenHistogramInner').innerHTML = frozenHistogramHtml;

    if (cardData.score[0] == 'Won') {
      winConfetti();
    }
  }
};

const getFrozenHistogramHtml = (ownedAssets) => {
  if (ownedAssets.length == 0) {
    return '';
  }
  let maxThawTimeHours = 0;
  let newFrozenCount = 0;

  const histogram = {};
  histogram['0.0'] = 0;

  for (let ix = 0; ix < ownedAssets.length; ix++) {
    const ownedAsset = ownedAssets[ix];
    if (ownedAsset.thawTimeMs !== undefined) {
      const thawTimeDiff = ownedAsset.thawTimeMs - Date.now();
      // console.log('getFrozenHistogramHtml', ownedAsset, thawTimeDiff);
      const thawTimeHours = (thawTimeDiff / (60*60*1000));
      if (thawTimeHours > maxThawTimeHours) {
        maxThawTimeHours = thawTimeHours;
      }
      const thawTimeHoursStr = thawTimeHours.toFixed(1);
      if (histogram[thawTimeHoursStr] == undefined) {
        histogram[thawTimeHoursStr] = 1;
      } else {
        histogram[thawTimeHoursStr] ++;
      }
    } else {
      if (ownedAsset.newFrozen) {
        newFrozenCount ++;
      } else {
        histogram['0.0'] ++;
      }
    }
  }

  // round off errors cause the tail to be cut.
  const newFrozenHours = maxThawTimeHours.toFixed(1) + '+';
  maxThawTimeHours += 0.2;

  // console.log('FrozenHistogram', histogram);
  let html = '';

  const addHistogramEntry = (count, hourStr) => {
    html += '<div class="card-body bg_color_yellow float_left" style="margin:0.4vmin">';
    html += count;
    html += ' cards in ';
    html += hourStr;
    html += ' hours ';
    html += '</div>';
  };

  for (let hour = 0; hour < maxThawTimeHours; hour+= 0.1) {
    const hourStr = hour.toFixed(1);
    // console.log('FrozenHistogram', 'hourStr', hourStr);
    if (histogram[hourStr] !== undefined) {
      const count = histogram[hourStr];
      addHistogramEntry(count, hourStr);
    }
  }
  if (newFrozenCount > 0) {
    addHistogramEntry(newFrozenCount, newFrozenHours);
  }
  return html;
};

const getOwnedAssetTemplateHtml = (templateId, ownedAssets) => {
  if (ownedAssets.length == 0) {
    return '';
  }

  let frozenCount = 0;
  for (let ix = 0; ix < ownedAssets.length; ix++) {
    const ownedAsset = ownedAssets[ix];
    frozenCount += ownedAsset.frozen;
  }

  let ownedAssetsHtml = '';
  ownedAssetsHtml += '<div class="card-body bg_color_yellow float_left" style="margin:0.4vmin">';
  ownedAssetsHtml += `${ownedAssets[0].name}[${ownedAssets[0].rarity}] (count ${ownedAssets.length}, frozen ${frozenCount})`;
  ownedAssetsHtml += ` `;
  ownedAssetsHtml += `<a class="card-title" target="_blank" href="https://wax.atomichub.io/market?template_id=${templateId}&order=asc&sort=price&symbol=WAX">`;
  ownedAssetsHtml += `Store`;
  ownedAssetsHtml += `</a>`;
  ownedAssetsHtml += '</div>';
  return ownedAssetsHtml;
};

const getOwnedAssetHtml = (ownedAsset) => {
  let ownedAssetsHtml = '';
  let border = '';
  let filter = '';
  const frozen = ownedAsset.frozen || (ownedAsset.newFrozen == true);
  if (frozen) {
    border = 'border-width:0.2vh;border-color:blue;background-color:lightblue;color:black;';
  } else {
    border = 'border-width:0.2vh;border-color:black;background-color:white;color:black;';
  }
  if (frozen) {
    filter += ` filter:blur(${blurSize});`;
  }
  const src = `/ipfs/${ownedAsset.img}.webp`;
  ownedAssetsHtml += `<div style="${border}margin:1.0vh;" class="bordered float_left">`;
  ownedAssetsHtml += `<image style="margin:1.0vh;${filter}" class="bordered" src="${src}">`;
  ownedAssetsHtml += '<br>';
  ownedAssetsHtml += `<span style="${border}" class="selectable">`;
  ownedAssetsHtml += ownedAsset.name;
  ownedAssetsHtml += `(${ownedAsset.assetId})`;
  ownedAssetsHtml += '</span>';
  ownedAssetsHtml += '<br>';
  ownedAssetsHtml += `Frozen:${frozen}`;

  if (ownedAsset.thawTimeMs !== undefined) {
    if (ownedAsset.thawTimeMs > 0) {
      const thawTimeDiff = ownedAsset.thawTimeMs - Date.now();
      const thawTimeHours = (thawTimeDiff / (60*60*1000)).toFixed(3);
      ownedAssetsHtml += ` Thaw Time:${thawTimeHours} Hours`;
    }
  }
  // ownedAssetsHtml += JSON.stringify(ownedAsset);
  ownedAssetsHtml += '</div>';
  return ownedAssetsHtml;
};

const asOrderedList = (list, activeCheckList, giveawayCheckList) => {
  let eligibleHtml = '<h4>Elgible for Giveaway</h4><ol>';
  let ineligibleHtml = '<h4>Inelgible for Giveaway</h4><ol>';
  if (list != undefined) {
    for (let ix = 0; ix < list.length; ix++) {
      const elt = list[ix];
      let html = '';
      html += '<li>';
      html += elt;
      if (activeCheckList.includes(elt)) {
        html += '(withdrew)';
      } else {
        html += '(no withdrawal yet)';
      }
      if (giveawayCheckList.includes(elt)) {
        html += '(over min plays)';
      } else {
        html += '(under min plays)';
      }
      html += '</li>';
      if (activeCheckList.includes(elt) && giveawayCheckList.includes(elt)) {
        eligibleHtml += html;
      } else {
        ineligibleHtml += html;
      }
    }
  }
  eligibleHtml += '</ol>';
  ineligibleHtml += '</ol>';
  const html = eligibleHtml + ineligibleHtml;
  return html;
};

const resetScoreText = async () => {
  const scoreText = [];
  if (cardData === undefined) {
    return;
  }

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

  if (cardData.cardCount == 0) {
    scoreText.push('No Cards, Play Disabled');
    document.querySelector('#play').disabled = true;
  }

  let frozenCount = 0;
  let totalCount = 0;
  if (cardData.ownedAssets != undefined) {
    cardData.ownedAssets.forEach((ownedAsset) => {
      if (ownedAsset.frozen) {
        frozenCount++;
      }
      totalCount++;
    });
  }

  scoreText.push(`Card Types: ${cardData.cardCount} of ${cardData.templateCount}, Frozen ${frozenCount} of ${totalCount}`);

  document.querySelector('#activeUsers').innerText =
    `${cardData.activeUsers} of ${cardData.totalUsers} total, ` +
    `${cardData.activeUsersSinceRestart} since last restart.`;
  document.querySelector('#totalWinsAndLosses').innerText =
      `${cardData.totalWinsSinceRestart} wins ` +
      `${cardData.totalLossesSinceRestart} losses in total since last restart.`;
  document.querySelector('#totalFrozenCards').innerText =
      `${cardData.totalFrozenCards}`;
  document.querySelector('#totalActiveCards').innerText =
      `${cardData.totalActiveCards}`;

  let cacheStats = '<br>Cache Miss Count:';
  if (cardData.cacheMissCountMap !== undefined) {
    cardData.cacheMissCountMap.forEach((elt, eltIx) => {
      if (eltIx > 0) {
        cacheStats += ', ';
      }
      cacheStats += `${elt[0]}:${elt[1]}`;
    });
  }
  cacheStats += '<br>Cache Hit Count:';
  if (cardData.cacheHitCountMap !== undefined) {
    cardData.cacheHitCountMap.forEach((elt, eltIx) => {
      if (eltIx > 0) {
        cacheStats += ', ';
      }
      cacheStats += `${elt[0]}:${elt[1]}`;
    });
  }
  cacheStats += '<br>Frozen Rarity Count:';
  if (cardData.frozenCardsByRarityMap !== undefined) {
    cardData.frozenCardsByRarityMap.forEach((elt, eltIx) => {
      if (eltIx > 0) {
        cacheStats += ', ';
      }
      cacheStats += `${elt[0]}:${elt[1]}`;
    });
  }

  document.querySelector('#cacheStats').innerHTML = cacheStats;

  document.querySelector('#activeUsers2').innerText = document.querySelector('#activeUsers').innerText;

  document.querySelector('#activeUsersList2').innerHTML = asOrderedList(cardData.activeWaxUserList, cardData.ownersWithAccountsList, cardData.ownersEligibleForGiveawayList);

  document.querySelector('#totalWinsAndLosses2').innerText = document.querySelector('#totalWinsAndLosses').innerText;

  document.querySelector('#totalFrozenCards2').innerText = document.querySelector('#totalFrozenCards').innerText;

  document.querySelector('#totalActiveCards2').innerText = document.querySelector('#totalActiveCards').innerText;

  document.querySelector('#cacheStats2').innerHTML = document.querySelector('#cacheStats').innerHTML;


  // console.log(53*(1-Math.cbrt(2/3)))
  const idAmounts = cardData.bets;
  goodOdds = false;
  betExpectedValue = undefined;
  if (idAmounts !== undefined) {
    const bet = idAmounts[betFromSvgId];

    // console.log('bet', bet);
    // console.log('cardData.payoutMultiplier', cardData.payoutMultiplier);
    // console.log('cardData.betBonus', cardData.betBonus);

    const betLoss = bet;
    const betWin = (bet * cardData.payoutMultiplier) + cardData.betBonus;
    const chanceWin = cardData.cardCount / cardData.templateCount;
    const expectedPctLoss = Math.pow(1 - chanceWin, 3);
    const expectedPctWin = 1 - expectedPctLoss;
    const expectedChanceToProfitPct = (betWin*expectedPctWin)/((betWin*expectedPctWin) + (betLoss*expectedPctLoss));
    const expectedValue = (betWin*expectedPctWin) - (betLoss*expectedPctLoss);
    // console.log('betLoss', betLoss, 'expectedPctLoss', expectedPctLoss.toFixed(4));
    // console.log('betWin', betWin, 'expectedPctWin', expectedPctWin.toFixed(4));
    // console.log('expectedChanceToProfitPct', expectedChanceToProfitPct);
    // console.log('expectedValue', expectedValue);
    const expectedPctWinStr = expectedPctWin * 100;
    const expectedChanceToProfitPctStr = expectedChanceToProfitPct * 100;
    scoreText.push(`Multiplier:${cardData.payoutMultiplier} Bonus:${cardData.betBonus.toFixed(4)}  Payout:${betWin.toFixed(4)} `);
    scoreText.push(`Chance To Win: ${expectedPctWinStr.toFixed(0)}% Exp Val:${expectedValue.toFixed(4)}`);
    scoreText.push(`Expected Profit Chance:${expectedChanceToProfitPctStr.toFixed(4)}`);
    if (expectedChanceToProfitPct > 0.5) {
      scoreText.push(`Good Odds:Yes`);
      goodOdds = true;
      betExpectedValue = expectedValue;
    } else {
      scoreText.push(`Good Odds:No`);
    }
  }
  const won = (Array.isArray(cardData.score)) && (cardData.score.length > 0) && (cardData.score[0] == 'Won');
  if (won) {
    setScore(scoreText, 'lightgreen', 'green');
  } else {
    if (goodOdds) {
      setScore(scoreText);
    } else {
      setScore(scoreText, 'pink', 'red');
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

const hideShowScoreDiv = (fill, stroke) => {
  const innerWidth = window.innerWidth;
  const innerHeight = window.innerHeight;
  const orientation = getOrientation();
  const hide = getHideFlag(innerWidth, innerHeight, orientation);
  if (hide) {
    document.querySelector('#td1').className = '';
    document.querySelector('#td2').className = '';
    document.querySelector('#td3').className = '';
    document.querySelector('#scoreDiv1').className = 'display_none';
    document.querySelector('#scoreDiv2').className = 'display_none';
    document.querySelector('#outerTable').className = 'w100vmin vertical_align_top';
  } else {
    let color = 'card bg_color_yellow color_black';
    if ((fill != undefined) && (stroke != undefined)) {
      color = `card fill_${fill}_stroke_${stroke}`;
    }
    document.querySelector('#td1').className = 'w20pct';
    document.querySelector('#td2').className = 'w60pct';
    document.querySelector('#td3').className = 'w20pct';
    document.querySelector('#card1').className = color;
    document.querySelector('#card3').className = color;
    document.querySelector('#scoreDiv1').className = '';
    document.querySelector('#scoreDiv2').className = '';
    document.querySelector('#outerTable').className = 'w200vmin vertical_align_top';
  }
  // addScoreDivInnerHeader();
};

const getHideFlag = (innerWidth, innerHeight, orientation) => {
  const hide = (innerWidth < (innerHeight*1.7)) || (orientation == 'portrait');
  return hide;
};

const getOrientation = () => {
  try {
    let orientation;
    if (window.orientation !== undefined) {
      if ((window.orientation == 0) || (window.orientation == 180)) {
        orientation = 'portrait';
      } else {
        orientation = 'landscape';
      }
    } else {
      orientation = !navigator.maxTouchPoints ? 'desktop' : !window.screen.orientation.angle ? 'portrait' : 'landscape';
    }
    return orientation;
  } catch (error) {
    alert(error.message);
  }
};

const addScoreDivInnerHeader = () => {
  try {
    const orientation = getOrientation();
    const innerWidth = window.innerWidth;
    const innerHeight = window.innerHeight;
    const hide = getHideFlag(innerWidth, innerHeight, orientation);
    const scoreDivInnerElt = document.querySelector('#scoreDivInner1');
    scoreDivInnerElt.innerHTML = `${window.innerWidth}w > ${window.innerHeight}h:hide:${hide} orientation:${orientation}<br>`;
  } catch (error) {
    alert(error.message);
  }
};

window.onresize = () => {
  hideShowScoreDiv();
};

if (window.screen.addEventListener) {
  window.screen.addEventListener('orientationchange', function() {
    hideShowScoreDiv();
  });
}

const setScore = (scoreText, fill, stroke) => {
  hideShowScoreDiv(fill, stroke);

  const scoreDivInner1Elt = document.querySelector('#scoreDivInner1');
  const scoreDivInner2Elt = document.querySelector('#scoreDivInner2');
  scoreDivInner1Elt.innerHTML = '';
  scoreDivInner2Elt.innerHTML = '';
  // addScoreDivInnerHeader();

  const scoreElt = getSvgSlotMachineElementById('score');
  clear(scoreElt);

  if ((fill != undefined) && (stroke != undefined)) {
    addChildSvgElement(scoreElt, 'rect', {'x': 107, 'y': 732, 'width': 330, 'height': 90, 'stroke': stroke, 'fill': fill, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-width': '10'});
  }

  let y = 750;

  const addTextElt = (text) => {
    scoreDivInner1Elt.innerHTML += text;
    scoreDivInner1Elt.innerHTML += '<br>';
    scoreDivInner2Elt.innerHTML += text;
    scoreDivInner2Elt.innerHTML += '<br>';
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
  parms.nonce_kind = window.localStorage.nonce_kind;
  parms.account = accountElt.value;
  parms.amount = amountElt.value;

  setScore('pending...');

  xmlhttp.timeout = 60000;
  xmlhttp.ontimeout = function() {
    alert('Timeout, refresh and retry.');
  };
  xmlhttp.onreadystatechange = function() {
    console.log('withdraw', this);
    if (this.readyState == 4) {
      if (this.status == 200) {
        withdrawButton.disabled = false;
        const response = JSON.parse(this.responseText);
        console.log('withdraw response', response);
        if (response.success) {
          setScore(response.message, 'green', 'white');
        } else {
          withdrawResponseElt.innerHTML = `<span class="bg_color_red">${response.message}</span>`;
          setScore(response.message, 'red', 'white');
        }
        withdrawResponseElt.innerText = response.message;
        if (response.success) {
          play();
        }
      } else {
        withdrawButton.disabled = false;
        const response = JSON.parse(this.responseText);
        console.log('withdraw error', response);
        withdrawResponseElt.innerHTML = `<span class="bg_color_red">${this.status}(${this.statusText}):${response.message}</span>`;
        setScore(response.message, 'red', 'white');
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

window.blackMonkeyAnswer = (answer) => {
  const xmlhttp = new XMLHttpRequest();
  const parms = {};
  parms.owner = window.localStorage.owner;
  parms.nonce = window.localStorage.nonce;
  parms.answer = answer;
  const blackMonkeyElt = document.getElementById('blackMonkey');
  clear(blackMonkeyElt);


  xmlhttp.timeout = 60000;
  xmlhttp.ontimeout = function() {
    alert('Timeout, refresh and retry.');
  };
  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const response = JSON.parse(this.responseText);
      console.log('bm', response);
      let classNm;
      let message;
      if (response.success) {
        classNm = 'bg_color_green';
        message = 'you win!';
        winConfetti();
        play();
      } else if (response.ready == false) {
        classNm = 'bg_color_red';
        message = response.errorMessage;
      } else {
        classNm = 'bg_color_red';
        message = response.message;
      }
      const html = `<span class="${classNm}">${message}</span>`;
      blackMonkeyElt.innerHTML = html;
    }
  };
  xmlhttp.open('POST', '/black_monkey', true);
  xmlhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xmlhttp.send(JSON.stringify(parms));
};

window.blackMonkeyImage = () => {
  const xmlhttp = new XMLHttpRequest();
  const parms = {};
  parms.owner = window.localStorage.owner;
  parms.nonce = window.localStorage.nonce;
  const blackMonkeyElt = document.getElementById('blackMonkey');
  clear(blackMonkeyElt);


  xmlhttp.timeout = 60000;
  xmlhttp.ontimeout = function() {
    alert('Timeout, refresh and retry.');
  };
  xmlhttp.onreadystatechange = function() {
    if (this.readyState == 4 && this.status == 200) {
      const response = JSON.parse(this.responseText);
      console.log(response);
      if (response.success) {
        const keys = [...Object.keys(response.images)];
        let html = '';
        for (let ix = 0; ix < keys.length; ix++) {
          const key = keys[ix];
          const image = response.images[key];
          html += `<button onclick="blackMonkeyAnswer('${key}');return false;">`;
          html += `<img style="width:25vmin;" src="${image}"></img>`;
          html += `</button>`;
        }
        blackMonkeyElt.innerHTML = html;
      } else if (response.ready == false) {
        const html = `<span class="bg_color_lightblue color_black">${response.errorMessage}</span>`;
        blackMonkeyElt.innerHTML = html;
      } else {
        const html = `<span class="bg_color_lightblue color_black">${response.message}</span>`;
        blackMonkeyElt.innerHTML = html;
      }
    }
  };
  xmlhttp.open('POST', '/black_monkey_images', true);
  xmlhttp.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
  xmlhttp.send(JSON.stringify(parms));
};

window.submitHcaptcha = () => {
  const hcaptchaElts = [...document.getElementsByName('h-captcha-response')];
  const hcaptchaElt = hcaptchaElts[0];
  const xmlhttp = new XMLHttpRequest();
  const parms = {};
  parms['h-captcha-response'] = hcaptchaElt.value;
  parms.owner = window.localStorage.owner;
  parms.nonce = window.localStorage.nonce;
  setScore('pending...');


  xmlhttp.timeout = 60000;
  xmlhttp.ontimeout = function() {
    alert('Timeout, refresh and retry.');
  };
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

window.showFAQ = () => {
  document.querySelector('#faqButton').disabled = true;
  document.querySelector('#additionlDetailsButton').disabled = false;
  document.querySelector('#slotMachineButton').disabled = false;
  document.querySelector('#faqTable').className = 'w100pct';
  document.querySelector('#additionlDetailsTable').className = 'display_none';
  document.querySelector('#slotMachineTable').className = 'display_none';
  document.querySelector('#ownedAssets').className = 'display_none';
  document.querySelector('#ownedAssetsInner').className = 'display_none';
  document.querySelector('#ownedAssetsTemplates').className = 'display_none';
  document.querySelector('#ownedAssetsTemplatesInner').className = 'display_none';
  document.querySelector('#frozenHistogram').className = 'display_none';
  document.querySelector('#frozenHistogramInner').className = 'display_none';
};

window.showSlotMachine = () => {
  document.querySelector('#faqButton').disabled = false;
  document.querySelector('#additionlDetailsButton').disabled = false;
  document.querySelector('#slotMachineButton').disabled = true;
  document.querySelector('#faqTable').className = 'display_none';
  document.querySelector('#additionlDetailsTable').className = 'display_none';
  document.querySelector('#slotMachineTable').className = 'w100pct';
  document.querySelector('#ownedAssets').className = 'display_none';
  document.querySelector('#ownedAssetsInner').className = 'display_none';
  document.querySelector('#ownedAssetsTemplates').className = 'display_none';
  document.querySelector('#ownedAssetsTemplatesInner').className = 'display_none';
  document.querySelector('#frozenHistogram').className = 'display_none';
  document.querySelector('#frozenHistogramInner').className = 'display_none';
  play();
};

window.showAdditionalDetails = () => {
  document.querySelector('#faqButton').disabled = false;
  document.querySelector('#additionlDetailsButton').disabled = true;
  document.querySelector('#slotMachineButton').disabled = false;
  document.querySelector('#faqTable').className = 'display_none';
  document.querySelector('#additionlDetailsTable').className = 'w100pct';
  document.querySelector('#slotMachineTable').className = 'display_none';
  document.querySelector('#ownedAssets').className = '';
  document.querySelector('#ownedAssetsInner').className = '';
  document.querySelector('#ownedAssetsTemplates').className = '';
  document.querySelector('#ownedAssetsTemplatesInner').className = '';
  document.querySelector('#frozenHistogram').className = '';
  document.querySelector('#frozenHistogramInner').className = '';
};

const winConfetti = () => {
  stopWinConfetti = false;
  const count = 200;
  const defaults = {
    origin: {y: 0.7},
    shapes: ['square', 'circle', 'emoji:🍌'],
    colors: ['#FFFF00', '#00FF00'],
  };

  function fire(particleRatio, opts) {
    if (document.hasFocus()) {
      confetti(Object.assign({}, defaults, opts, {
        particleCount: Math.floor(count * particleRatio),
      }));
    }
  }

  if (window.localStorage.autoplayOn == 'true') {
    fire(0.01, {
      spread: 1,
      startVelocity: 55,
    });
  } else {
    if (!stopWinConfetti) {
      fire(0.25, {
        spread: 26,
        startVelocity: 55,
      });
    }
    if (!stopWinConfetti) {
      fire(0.2, {
        spread: 60,
      });
    }
    if (!stopWinConfetti) {
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8,
      });
    }
    if (!stopWinConfetti) {
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2,
      });
    }
    if (!stopWinConfetti) {
      fire(0.1, {
        spread: 120,
        startVelocity: 45,
      });
    }
  }
};
