/* eslint-disable */
const atomicassetsUtil = require('../scripts/util/atomicassets-util.js');

const go = async () => {
  const templates = atomicassetsUtil.getTemplates();
  let total_issued = 0;
  let total_max = 0;
  templates.forEach((template) => {
    total_issued += template.issued_supply;
    total_max += template.max_supply;
    console.log(template.name, template.issued_supply, template.max_supply);
  });
  const average_issued = total_issued / templates.length;
  const average_max = total_max / templates.length;
  console.log('total', total_issued, total_max);
  console.log('average', average_issued.toFixed(2), average_max.toFixed(2));
};

const run = async () => {
  const loggingUtil = {};
  loggingUtil.log = console.log;
  loggingUtil.isDebugEnabled = () => {
    return false;
  };
  loggingUtil.debug = () => {};
  loggingUtil.trace = console.trace;
  atomicassetsUtil.init({maxAssetsPerPage: 119, maxTemplatesPerPage: 119}, loggingUtil);

  const waitOrGo = async () => {
    if (atomicassetsUtil.isReady()) {
      go();
    } else {
      setTimeout(waitOrGo, 10000);
    }
  };
  waitOrGo();
};

run();
