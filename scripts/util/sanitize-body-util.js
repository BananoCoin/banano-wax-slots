'use strict';
// libraries

// modules
// constants
// const SESSION_KEY_PATTERN_STR = '^[0123456789abcdefABCDEF]{64}$';
// const DRAWING_STR = '^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$';
// const VOTE_STR = '^[0123456789abcdefABCDEF]{64}$';
// const ACCOUNT_STR = '^ban_[13456789abcdefghijkmnopqrstuwxyz]{0,64}$';
// const ACTION_SET = new Set(['toggle', 'farLeft', 'left', 'attack', 'right', 'farRight', 'restart']);
// const PARAMETER_ZERO_SET = new Set(['attack', 'sonar', 'shield', 'camera', '']);
// const PARAMETER_ONE_SET = new Set([true, false]);
// const MAXIMIZE_SET = new Set(['true', 'false']);
// const OWNER_STR = '^[a-zA-Z0-9_\\.]+$';
// const NONCE_STR = '^[0-9]+$';
// const PAGE_STR = '^[a-zA-Z0-9\-]+$';
// const LANGUAGE_SET = new Set();
// const IMAGE_IX_STR = '^[0-9]+$';
// const PARTIAL_STR = '^true|false$';
// const PARTIAL_IX_STR = '^[0-9]+$';
// const NAME_STR = '^[0123456789abcdefABCDEF]{64}$';
// const ID_STR = '^[a-zA-Z0-9_]+$';

// variables
// const sessionKeyRegExp = new RegExp(SESSION_KEY_PATTERN_STR);
// const submissionTypeRegExp = new RegExp(SUBMISSION_TYPE_STR);
// const drawingRegExp = new RegExp(DRAWING_STR);
// const voteRegExp = new RegExp(VOTE_STR);
// const accountRegExp = new RegExp(ACCOUNT_STR);
// const ownerRegExp = new RegExp(OWNER_STR);
// const nonceRegExp = new RegExp(NONCE_STR);
// const pageRegExp = new RegExp(PAGE_STR);
// const imageIxRegExp = new RegExp(IMAGE_IX_STR);
// const partialRegExp = new RegExp(PARTIAL_STR);
// const partialIxRegExp = new RegExp(PARTIAL_IX_STR);
// const nameRegExp = new RegExp(NAME_STR);
// const idRegExp = new RegExp(ID_STR);

/* eslint-disable no-unused-vars */
let config;
let loggingUtil;
const regexpMap = new Map();
/* eslint-enable no-unused-vars */

// functions
const init = (_config, _loggingUtil) => {
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

  regexpMap.set('owner', new RegExp('^[a-zA-Z0-9_\\.]+$'));
  regexpMap.set('code', new RegExp('^[a-zA-Z0-9]+$'));
  regexpMap.set('nonce', new RegExp('^[a-f0-9]+$'));
  regexpMap.set('state', new RegExp('^[a-f0-9]+$'));
  regexpMap.set('bet', new RegExp('^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)$'));
  regexpMap.set('amount', new RegExp('^[+-]?([0-9]+\.?[0-9]*|\.[0-9]+)$'));
  regexpMap.set('account', new RegExp('^ban_[13456789abcdefghijkmnopqrstuwxyz]{0,64}$'));
  regexpMap.set('nonce_kind', new RegExp('^wax|cmc$'));
  regexpMap.set('referred_by', new RegExp('^[a-zA-Z0-9_\\.]*$'));
};

const deactivate = () => {
  /* eslint-disable no-unused-vars */
  config = undefined;
  loggingUtil = undefined;
  regexpMap.clear();
  /* eslint-enable no-unused-vars */
};

const sanitizeBody = (body) => {
  /* istanbul ignore if */
  if (body === undefined) {
    throw new Error('body is required.');
  }
  // throw Error('sanitizeBody');
  loggingUtil.debug('STARTING sanitizeBody', body);
  const keys = [...Object.keys(body)];
  // console.log('INTERIM sanitizeBody', 'keys', keys.length, keys );
  for (let ix = 0; ix < keys.length; ix++) {
    const key = keys[ix];
    const value = body[key];
    let isValid = false;
    let invalidReason = undefined;

    const testRegExp = (regExp, regExpStr, key, value) => {
      // console.log('INTERIM sanitizeBody', 'testRegExp', regExp, regExpStr, key, value );
      isValid = regExp.test(value);
      if (!isValid) {
        invalidReason = `invalid '${key}' in body '${value}' does not match pattern '${regExpStr}'`;
      }
    };

    if (regexpMap.has(key)) {
      const regexp = regexpMap.get(key);
      testRegExp(regexp, regexp.source, key, value);
    }

    // console.log('INTERIM sanitizeBody', 'key', key, 'value', value, 'isValid', isValid, 'invalidReason', invalidReason);
    if (!isValid) {
      if (invalidReason === undefined) {
        invalidReason = `unknown key '${key}' in body with value '${value}' body:'${JSON.stringify(body)}'`;
      }
      // console.log('FAILURE sanitizeBody', body, invalidReason);
      throw Error(invalidReason);
    }

    // console.log('INTERIM sanitizeBody', key, body[key] );
  }
  loggingUtil.debug('FINISHED sanitizeBody');
};

export default {
  init,
  deactivate,
  sanitizeBody,
};
