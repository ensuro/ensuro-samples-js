const { ethers } = require('ethers');
const { DefenderRelaySigner, DefenderRelayProvider } = require('defender-relay-client/lib/ethers');

function getDefenderRelaySigner(API_KEY, API_SECRET) {
  const credentials = { apiKey: API_KEY, apiSecret: API_SECRET };
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
  return signer;
}

function getSigner(env) {
  if (env.RELAY_API_KEY) {
    return getDefenderRelaySigner(env.RELAY_API_KEY, env.RELAY_API_SECRET);
  } else {
    let provider;
    if (env.WEB3_RPC_URL) {
      provider = new ethers.providers.JsonRpcProvider(env.WEB3_RPC_URL);
    } else {
      const options = {};
      if (env.WEB3_INFURA_PROJECT_ID)
        options.infura = env.WEB3_INFURA_PROJECT_ID;
      if (env.WEB3_ALCHEMY_TOKEN)
        options.alchemy = env.WEB3_ALCHEMY_TOKEN;
      if (env.WEB3_ETHERSCAN_TOKEN)
        options.etherscan = env.WEB3_ETHERSCAN_TOKEN;
      provider = ethers.getDefaultProvider(env.WEB3_NETWORK, options);
    }
    return new ethers.Wallet(env.ACCOUNT_PK, provider);
  }
}

module.exports = {getSigner, getDefenderRelaySigner};
