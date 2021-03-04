const atomicassetsUtil = require('../scripts/util/atomicassets-util.js');

const run = async (owner) => {
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
      const assetMap = {};
      const assets = await atomicassetsUtil.getOwnedCards(owner);
      assets.forEach((asset) => {
        if (assetMap[asset.name] == undefined) {
          assetMap[asset.name] = new Set();
        }
        assetMap[asset.name].add(asset.asset_id);
      });
      let total = 0;
      Object.keys(assetMap).forEach((name) => {
        const length = [...assetMap[name]].length;
        total += length;
        console.log(name, length);
      });
      console.log('total', total);
    } else {
      setTimeout(waitOrGo, 10000);
    }
  };
  waitOrGo();
};

run(process.argv[2]);
