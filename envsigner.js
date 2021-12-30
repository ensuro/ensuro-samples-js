const { DefenderRelaySigner, DefenderRelayProvider } = require('defender-relay-client/lib/ethers');

function getDefenderRelaySigner(API_KEY, API_SECRET) {
  const credentials = { apiKey: API_KEY, apiSecret: API_SECRET };
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
  return signer;
}

function getSigner(env) {
  if (env.API_KEY) {
    return getDefenderRelaySigner(env.API_KEY, env.API_SECRET);
  } else {
  }
}

module.exports = {getSigner, getDefenderRelaySigner};
