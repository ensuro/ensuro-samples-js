const { ethers } = require('ethers');

const ABIS = {
  TrustfulRiskModule: require("./abis/TrustfulRiskModule.json").abi,
  FlightDelayRiskModule: require("./abis/FlightDelayRiskModule.json").abi,
  PolicyPool: require("./abis/PolicyPool.json").abi,
  EToken: require("./abis/EToken.json").abi,
};

const _BN = ethers.BigNumber.from;
const WAD = _BN(1e10).mul(_BN(1e8));  // 1e10*1e8=1e18
const RAY = WAD.mul(_BN(1e9));  // 1e18*1e9=1e27

const PRICER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PRICER_ROLE"));
const RESOLVER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RESOLVER_ROLE"));
const NEW_POLICY_EVENT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(
  "NewPolicy(address,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,uint40,uint40))"
));

function amountDecimals() {
  // Decimals must be at least 6
  let decimals = Number.parseInt(process.env.AMOUNT_DECIMALS || "6");
  console.assert(decimals >= 6);
  return decimals;
}

/**
 * Function used to convert amounts - Takes int or float and returns a BigNumber with fixed decimals
 *
 * @param {value} Value to convert - If already BigNumber doesn't do anything
 */
function _A(value) {
  if (ethers.BigNumber.isBigNumber(value)){
    return value;
  }
  if (typeof value === 'string' || value instanceof String) {
    return _BN(value).mul(_BN(Math.pow(10, amountDecimals())));
  } else {
    return _BN(Math.round(value * 1e6)).mul(_BN(Math.pow(10, amountDecimals() - 6)));
  }
}


/**
 * Function used to convert to RAY (used for ratios, percentages, etc.)
 *
 * @param {value} Value to convert - If already BigNumber doesn't do anything
 */
function _R(value) {
  if (ethers.BigNumber.isBigNumber(value)){
    return value;
  }
  if (!Number.isInteger(value))
    return _BN(value * 1e9).mul(WAD);
  return _BN(value).mul(RAY);
}

async function newPolicy(internalId, data, customer, rm) {
  let expiration = data.expiration;
  if (expiration < 1600000000) {
    // it's a relative expiration timestamp;
    expiration = Math.floor(Date.now() / 1000) + expiration;
  }
  if (data.premium === undefined) {
    // premium undefined, compute it using getMinimumPremium
    data.premium = await rm.getMinimumPremium(_A(data.payout), _R(data.lossProb), expiration);
  }
  const tx = await rm.newPolicy(
    _A(data.payout), _A(data.premium), _R(data.lossProb), expiration, customer, internalId,
    {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the
                        // transaction - remove in production
  );
  console.debug(`Transaction created: ${tx.hash}`);
  return tx;
}

async function newFlightDelayPolicy(internalId, data, customer, rm) {
  const tx = await rm.newPolicy(
    data.flight, data.departure, data.expectedArrival, data.tolerance,
    _A(data.payout), _A(data.premium), _R(data.lossProb), customer, internalId,
    {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the
                        // transaction - remove in production
  );
  console.debug(`Transaction created: ${tx.hash}`);
  return tx;
}

function decodeNewPolicyReceipt(receipt) {
  const events = receipt.logs.filter(e => e.topics[0] === NEW_POLICY_EVENT);

  return parsePolicyData(events[0].data);
}

async function resolvePolicyFullPayout(policyData, customerWon, rm) {
  const tx = await rm.resolvePolicyFullPayout(policyData, customerWon,
    {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the
                       // transaction - remove in production
  );
  console.debug(`Transaction created: ${tx.hash}`);
  return tx;
}

async function resolvePolicy(policyData, payout, rm) {
  const tx = await rm.resolvePolicyFullPayout(policyData, _A(payout),
    {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the
                       // transaction - remove in production
  );
  console.debug(`Transaction created: ${tx.hash}`);
  return tx;
}

/**
 * Triggers the resolution of a FlightDelay Policy without waiting
 * the scheduled job / expiration
 *
 * @param policyId int  Id of the policy
 */
async function resolveFlightDelayPolicy(policyId, rm) {
  const tx = await rm.resolvePolicy(policyId,
    {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the
                       // transaction - remove in production
  );
  console.debug(`Transaction created: ${tx.hash}`);
  return tx;
}

async function getETokens(pool, options) {
  const etkCount = (await pool.getETokenCount()).toNumber();
  const ret = [];
  console.debug(etkCount);
  // TODO: paralellize using Promise.all or something else
  for (i=0; i<etkCount; i++) {
    const etkAddress = await pool.getETokenAt(i);
    console.debug(`etkAddress: ${etkAddress}`);
    ret.push(new ethers.Contract(etkAddress, ABIS.EToken, pool.signer));
  }
  return ret;
}

function parsePolicyData(hexPolicyData){
  let policyData = {}
  let data = []
  let id = hexPolicyData.substring(0,66);
  data.push(id);
  policyData.id = id;

  let payout = '0x' + hexPolicyData.substring(66,130);
  data.push(payout);
  policyData.payout = payout;

  let premium = '0x' + hexPolicyData.substring(130,194);
  data.push(premium);
  policyData.premium = premium;

  let scr = '0x' + hexPolicyData.substring(194,258);
  data.push(scr);
  policyData.scr = scr;

  let lossProb = '0x' + hexPolicyData.substring(258,322);
  data.push(lossProb);
  policyData.lossProb = lossProb;

  let purePremium = '0x' + hexPolicyData.substring(322,386);
  data.push(purePremium);
  policyData.purePremium = purePremium;

  let premiumForEnsuro = '0x' + hexPolicyData.substring(386,450);
  data.push(premiumForEnsuro);
  policyData.premiumForEnsuro = premiumForEnsuro;

  let premiumForRm = '0x' + hexPolicyData.substring(450,514);
  data.push(premiumForRm);
  policyData.premiumForRm = premiumForRm;

  let premiumForLps = '0x' + hexPolicyData.substring(514,578);
  data.push(premiumForLps);
  policyData.premiumForLps = premiumForLps;

  let address = '0x' + hexPolicyData.substring(602,642);
  data.push(address);
  policyData.riskModule = address;

  let start = '0x' + hexPolicyData.substring(696,706);
  data.push(start);
  policyData.start = start;

  let expiration = '0x' + hexPolicyData.substring(760,770);
  data.push(expiration);
  policyData.expiration = expiration;

  policyData.data = data;
  return policyData;
}

module.exports = {
  newPolicy, newFlightDelayPolicy,
  resolvePolicy, resolvePolicyFullPayout, resolveFlightDelayPolicy,
  _A, _R,
  decodeNewPolicyReceipt, parsePolicyData, getETokens,
  PRICER_ROLE, RESOLVER_ROLE, NEW_POLICY_EVENT, ABIS
};
