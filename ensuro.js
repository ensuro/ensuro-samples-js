const { ethers } = require('ethers');

const _BN = ethers.BigNumber.from;

/**
 * Creates a fixed-point conversion function for the desired number of decimals
 * @param decimals The number of decimals. Must be >= 6.
 * @returns The amount function created. The function can receive strings (recommended),
 *          floats/doubles (not recommended) and integers.
 *
 *          Floats will be rounded to 6 decimal before scaling.
 */
function amountFunction(decimals) {
  return function (value) {
    if (value === undefined) return undefined;

    if (typeof value === "string" || value instanceof String) {
      return ethers.utils.parseUnits(value, decimals);
    }

    if (!Number.isInteger(value)) {
      return _BN(Math.round(value * 1e6)).mul(_BN(Math.pow(10, decimals - 6)));
    }

    return _BN(value).mul(_BN(10).pow(decimals));
  };
}

const _W = amountFunction(18);
const _A = amountFunction(6);

function getABI(contractName) {
  if (contractName === "IERC20Metadata") {
    return require("@ensuro/core/build/contracts/dependencies/IERC20Metadata.sol/IERC20Metadata.json").abi;
  }
  if (contractName.startsWith("I")) {
    return require(`@ensuro/core/build/contracts/interfaces/${contractName}.sol/${contractName}.json`).abi;
  } else {
    return require(`@ensuro/core/build/contracts/${contractName}.sol/${contractName}.json`).abi;
  }
}

async function newPolicy(internalId, data, customer, rm) {
  let expiration = data.expiration;
  if (expiration < 1600000000) {
    // it's a relative expiration timestamp;
    expiration = Math.floor(Date.now() / 1000) + expiration;
  }
  if (data.premium === undefined) {
    // premium undefined, compute it using getMinimumPremium
    data.premium = await rm.getMinimumPremium(_A(data.payout), _W(data.lossProb), expiration);
  }
  const tx = await rm.newPolicy(
    _A(data.payout), _A(data.premium), _W(data.lossProb), expiration, customer, internalId,
    /*{gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the
                        // transaction - remove in production*/
  );
  console.debug(`Transaction created: ${tx.hash}`);
  return tx;
}

async function newSignedQuotePolicy(data, customer, rm) {
  let premium;
  if (data.premium === null || data.premium === undefined) {
    premium = ethers.constants.MaxUint256;
  } else {
    premium = _A(data.premium);
  }
  const tx = await rm.newPolicy(
    _A(data.payout),  // Must be exactly the same payout sent to quote API
    premium,  // If premium == null in the response, then ethers.constants.MaxUint256
    _W(data.lossProb), // The lossProb received from quote API
    data.expiration,  // Must be exactly the same expiration value sent to the API
    customer,  // This is the address who owns the policy and will receive the payout,
               // but the premium is paid by the message sender.
    data.data_hash, // data_hash parameter from quote API response
    data.quote.signature_r,  // signature.r in the API response
    data.quote.signature_vs, // signature.vs in the API response
    data.quote.valid_until,  // valid_until in the API response
    {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the
                        // transaction - remove in production*/
  );
  console.debug(`Transaction created: ${tx.hash}`);
  return tx;
}

async function newFlightDelayPolicy(internalId, data, customer, rm) {
  const tx = await rm.newPolicy(
    data.flight, data.departure, data.expectedArrival, data.tolerance,
    _A(data.payout), _A(data.premium), _W(data.lossProb), customer, internalId,
    {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the
                        // transaction - remove in production
  );
  console.debug(`Transaction created: ${tx.hash}`);
  return tx;
}

/**
 * Finds an event in the receipt
 * @param {Interface} interface The interface of the contract that contains the requested event
 * @param {TransactionReceipt} receipt Transaction receipt containing the events in the logs
 * @param {String} eventName The name of the event we are interested in
 * @returns {LogDescription}
 */
const getTransactionEvent = function (interface, receipt, eventName) {
  // for each log in the transaction receipt
  for (const log of receipt.events) {
    let parsedLog;
    try {
      parsedLog = interface.parseLog(log);
    } catch (error) {
      continue;
    }
    if (parsedLog.name == eventName) {
      return parsedLog;
    }
  }
  return null; // not found
};

function decodeNewPolicyReceipt(receipt) {
  const poolInterface = new ethers.utils.Interface(getABI("PolicyPool"));
  const evt = getTransactionEvent(poolInterface, receipt, "NewPolicy");
  const policy = evt.args.policy;
  return {
    riskModule: policy.riskModule,
    // Returns the PolicyData as tuple, it will be required for expiration or resolution transactions
    data: [
      policy.id.toHexString(),
      policy.payout.toHexString(),
      policy.premium.toHexString(),
      policy.jrScr.toHexString(),
      policy.srScr.toHexString(),
      policy.lossProb.toHexString(),
      policy.purePremium.toHexString(),
      policy.ensuroCommission.toHexString(),
      policy.partnerCommission.toHexString(),
      policy.jrCoc.toHexString(),
      policy.srCoc.toHexString(),
      policy.riskModule,
      policy.start,
      policy.expiration,
    ],
  };
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
  const tx = await rm.resolvePolicy(policyData, _A(payout),
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

async function fetchRiskModuleParams(rm) {
  const params = await rm.params();
  const maxPayoutPerPolicy = await rm.maxPayoutPerPolicy();
  const exposureLimit = await rm.exposureLimit();
  const maxDuration = await rm.maxDuration();
  const wadTo4 = _BN(10).pow(18 - 4);
  const amountTo2 = _BN(10).pow(4);
  return {
    moc: params.moc.div(wadTo4).toNumber() / 10000,
    jrCollRatio: params.jrCollRatio.div(wadTo4).toNumber() / 10000,
    collRatio: params.collRatio.div(wadTo4).toNumber() / 10000,
    ensuroPpFee: params.ensuroPpFee.div(wadTo4).toNumber() / 10000,
    ensuroCocFee: params.ensuroCocFee.div(wadTo4).toNumber() / 10000,
    jrRoc: params.jrRoc.div(wadTo4).toNumber() / 10000,
    srRoc: params.srRoc.div(wadTo4).toNumber() / 10000,
    maxPayoutPerPolicy: maxPayoutPerPolicy.div(amountTo2).toNumber() / 100,
    exposureLimit: exposureLimit.div(amountTo2).toNumber() / 100,
    maxDuration: maxDuration.toNumber(),
  }
}

const secondsPerYear = 3600 * 24 * 365;

function computePremium(rmParams, payout, lossProb, expiration) {
  const purePremium = payout * lossProb * rmParams.moc;
  const jrScr = Math.max(payout * rmParams.jrCollRatio - purePremium, 0);
  const srScr = Math.max(payout * rmParams.collRatio - purePremium - jrScr, 0);
  const now = Math.round((new Date()).getTime() / 1000);
  const jrCoc = ((expiration - now) / secondsPerYear) * rmParams.jrRoc * jrScr;
  const srCoc = ((expiration - now) / secondsPerYear) * rmParams.srRoc * srScr;
  const ensuroCommission = purePremium * rmParams.ensuroPpFee + (jrCoc + srCoc) * rmParams.ensuroCocFee;
  const minimumPremium = purePremium + jrCoc + srCoc + ensuroCommission;
  return {
    minimumPremium: minimumPremium,
    purePremium: purePremium,
    ensuroCommission: ensuroCommission,
    jrCoc: jrCoc,
    srCoc: srCoc,
    jrScr: jrScr,
    srScr: srScr,
  }
}

module.exports = {
  newPolicy, newFlightDelayPolicy, newSignedQuotePolicy,
  resolvePolicy, resolvePolicyFullPayout, resolveFlightDelayPolicy,
  fetchRiskModuleParams, computePremium,
  _A, _W,
  decodeNewPolicyReceipt, getABI,
};
