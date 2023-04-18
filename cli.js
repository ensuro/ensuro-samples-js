#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const axios = require("axios");


const RM_ADDRESS = process.env.RM_ADDRESS;

const yargs = require('yargs');
const ensuro = require('./ensuro.js');
const envsigner = require('./envsigner.js');
const signer = envsigner.getSigner(process.env);

async function newPolicyCommand(argv) {
  const ABI = ensuro.getABI(argv.rmType);
  const rm = new ethers.Contract(argv.rmAddress, ABI, signer);
  const policyData = JSON.parse(fs.readFileSync(argv.policyData));
  const fn = {
    TrustfulRiskModule: ensuro.newTrustfulPolicy,
    SignedQuoteRiskModule: ensuro.newSignedQuotePolicy,
    FlightDelayRiskModule: ensuro.newFlightDelayPolicy
  }[argv.rmType];
  const tx = await fn(policyData, argv.customer, rm);
  // The transaction was sent to the blockchain. It might take sometime to approve, to
  // avoid sending duplicated policies, it's better to save the {tx.hash} and check asyncronously
  // the result of the transaction
  const receipt = await tx.wait();
  const createPolicyData = ensuro.decodeNewPolicyReceipt(receipt);
  console.log(`New Policy was created - TX: ${tx.hash}`);
  // Copy fields from input file into output file
  if (argv.copyFields) {
    argv.copyFields.split(",").forEach((fieldName) => {
      createPolicyData[fieldName] = policyData[fieldName];
    });
  }
  const outputFile = argv.outputFile || `./PolicyData-${tx.hash}.json`;
  fs.writeFile(outputFile, JSON.stringify(createPolicyData, null, 4), (err) => {
    if (err) {  console.error(err);  return; };
  });
}

async function resolvePolicyCommand(argv) {
  const ABI = ensuro.getABI(argv.rmType);
  const policyData = JSON.parse(fs.readFileSync(argv.policyData));
  const rmAddress = argv.rmAddress || policyData.riskModule || policyData.data[11];
  const rm = new ethers.Contract(rmAddress, ABI, signer);
  let tx;
  if (argv.result.toLowerCase() == "false" || argv.result.toLowerCase() == "true") {
    tx = await ensuro.resolvePolicyFullPayout(policyData.data, argv.result.toLowerCase() == "true", rm);
  } else {
    tx = await ensuro.resolvePolicy(policyData.data, Number.parseFloat(argv.result), rm);
  }
  await tx.wait();
}

async function resolveFDPolicyCommand(argv) {
  const rm = new ethers.Contract(argv.rmAddress, ensuro.ABIS.FlightDelayRiskModule, signer);
  let tx;
  let policyId = argv.rmAddress + argv.internalId.toString(16).padStart(24, "0");
  tx = await ensuro.resolveFlightDelayPolicy(policyId, rm);
  await tx.wait();
}

async function fetchRMParamsCommand(argv) {
  const ABI = ensuro.getABI(argv.rmType);
  const rm = new ethers.Contract(argv.rmAddress, ABI, signer);
  const params = await ensuro.fetchRiskModuleParams(rm);
  if (argv.outputFile == "-") {
    console.log("Params: ", params);
  } else {
    fs.writeFile(argv.outputFile, JSON.stringify(params, null, 4), (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
    });
  }
}

async function computePremium(argv) {
  let rmParams;
  if (argv.rmParams) {
    rmParams = JSON.parse(fs.readFileSync(argv.rmParams));
  } else {
    const ABI = ensuro.getABI(argv.rmType);
    const rm = new ethers.Contract(argv.rmAddress, ABI, signer);
    rmParams = await ensuro.fetchRiskModuleParams(rm);
  }
  let expiration;
  if (argv.expiration >= 1672691181) {
    // Timestamp
    expiration = parseInt(argv.expiration);
  } else if (argv.expiration < 1000) {
    // Relative Timestamp in days
    expiration = Math.round((new Date()).getTime() / 1000) + argv.expiration * 3600 * 24;
  } else {
    // Relative Timestamp in seconds
    expiration = Math.round((new Date()).getTime() / 1000) + argv.expiration;
  }
  const result = ensuro.computePremium(rmParams, argv.payout, argv.lossProb, expiration);
  if (argv.outputFile == "-") {
    console.log("Result: ", result);
  } else {
    fs.writeFile(argv.outputFile, JSON.stringify(result, null, 4), (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
    });
  }
}

async function printTotalSupply(argv) {
  const etk = new ethers.Contract(argv.etkAddress, ensuro.getABI("EToken"), signer);
  const etkName = await etk.name();
  const totalSupply = await etk.totalSupply();
  console.log(`Token ${etkName}, totalSupply: ${totalSupply}`);
}

async function approve(argv) {
  const token = new ethers.Contract(argv.erc20Address, ensuro.getABI("IERC20Metadata"), signer);
  const tx = await token.approve(argv.spender, argv.approvalLimit);
  console.log(`Approval transaction sent - TX: ${tx.hash}`);
}

async function faucet(argv) {
  const ABI = [{
    "inputs": [],
    "name": "tap",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }];
  const faucet = new ethers.Contract(argv.faucetContract, ABI, signer);
  const tx = await faucet.tap();
  console.log(`Faucet tap transaction sent - TX: ${tx.hash}`);
}

async function quotePolicy(argv) {
  /**
   * curl --request POST \
   * --url https://dynamic-pricing-btzmg4hp.nw.gateway.dev/api/v0/dlt \
   * --header 'accept: application/application/json' \
   * --header 'content-type: application/json' \
   * --header 'x-api-key: <APIKEY-FROM-ENV>' \
   * --data '{"payout": "5000","expiration": "2023-01-01T21:36:07.211025Z",
   *          "data": {"payout_type": "proportional", "client_name": "Foo Inc."}}'
   */
  const API_KEY = process.env.QUOTE_API_KEY;
  if (!API_KEY) {
    console.log("Error, API key not defined, must define environment variable QUOTE_API_KEY");
    process.exit(1);
  }
  let expiration;
  if (argv.expiration.match(RegExp("^1[0-9]{9}$"))) {
    // Timestamp
    expiration = parseInt(argv.expiration);
  } else if (argv.expiration.match(RegExp("^[0-9]{1,8}$"))) {
    // Relative Timestamp
    expiration = Math.round((new Date()).getTime() / 1000) + parseInt(argv.expiration);
  } else {
    // Assume timestamp in ISO-8601 format
    expiration = argv.expiration;
  }
  let jsonData;
  if (argv.jsonData.startsWith("https://") || argv.jsonData.startsWith("http://")) {
    // Remote JSON file
    jsonData = (await axios.get(argv.jsonData)).data;
  } else if (argv.jsonData.endsWith(".json")) {
    jsonData = JSON.parse(fs.readFileSync(argv.policyData));
  } else {
    jsonData = JSON.parse(argv.jsonData);
  }
  const jsonParams = {payout: argv.payout, expiration: expiration, data: jsonData};
  console.log(`Calling '${argv.apiEndpoint}' with these params: `, jsonParams);
  const response = await axios.post(
    argv.apiEndpoint,
    jsonParams,
    {headers: {"x-api-key": API_KEY}}
  );
  if (argv.outputFile == "-") {
    console.log("Response: ", response.data);
  } else {
    // If saving to a file, I save in the format required by newPolicyCommand for signed quotes,
    // similar to `sample-policy-signed-quote.json`
    console.log("Response: ", response.data);
    const output = {
      payout: argv.payout,
      premium: response.data.premium,
      lossProb: response.data.loss_prob,
      expiration: response.data.expiration,
      data_hash: response.data.data_hash,
      quote: {
        signature_r: response.data.signature.r,
        signature_vs: response.data.signature.vs,
        valid_until: response.data.valid_until,
      }
    }
    fs.writeFile(argv.outputFile, JSON.stringify(output, null, 4), (err) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
    });
  }
}

yargs.scriptName("ensuro-cli")
  .usage('$0 <cmd> [args]')
  .command('new-policy <policyData> <customer> [--rm <rm-address>]',
           'Create new policy', (yargs) => {
    yargs.positional('policyData', {
      type: 'string',
      describe: 'Json file with the data of the policy to be created - See sample-policy-<rmType>.json'
    });
    yargs.positional('customer', {
      type: 'string',
      describe: 'Address that pays the premium and receives the payout'
    });
    yargs.option("rmType", {
      describe: "Type of RiskModule",
      default: "SignedQuoteRiskModule"
    });
    yargs.option("rmAddress", {
      describe: "Address of the RiskModule contract ",
      type: "string",
      default: RM_ADDRESS
    });
    yargs.option("outputFile", {
      type: "string",
      describe: "Output file where the policy data will be saved (json)",
    });
    yargs.option("copyFields", {
      type: "string",
      describe: "Fields to copy from input file into output file",
    });
  }, newPolicyCommand)
  .command('quote-policy <apiEndpoint>',
           'Get a signed quote from API', (yargs) => {
    yargs.positional('apiEndpoint', {
      type: 'string',
      describe: `The Quote API endpoint.
Example: https://dynamic-pricing-btzmg4hp.nw.gateway.dev/api/v0/<customer>`
    });
    yargs.option('jsonData', {
      type: 'string',
      describe: `Extra data of the policy to be used for the quote and stored.
It will be converted to a blind hash on-chain`
    });
    yargs.option("payout", {
      describe: "Maximum payout of the policy",
      type: 'number',
    });
    yargs.option("expiration", {
      describe: `Expiration of the policy.
Can be sent as ISO 8601 timestamp, epoch timestamp or integer (seconds relative to now)`,
      type: 'string',
      default: '2592000', // 30 days (in seconds)
    });
    yargs.option("outputFile", {
      type: "string",
      describe: "Output file where the policy data will be saved (json). Default stdout",
      default: "-"
    });
  }, quotePolicy)
  .command('resolve-policy <policyData> <result>', 'Resolve policy', (yargs) => {
    yargs.positional('policyData', {
      type: 'string',
      describe: 'Json file with the full data of the policy, generated by new-policy'
    });
    yargs.positional('result', {
      type: 'string',
      describe: 'Resolution of the policy. Might be "true" or "false" if full payout or number'
    });
    yargs.option("rmType", {
      describe: "Type of RiskModule",
      default: "SignedQuoteRiskModule"
    });
    yargs.option("rmAddress", {
      describe: "Address of the RiskModule contract (if undefined, took from policyData)",
      type: "string",
      default: undefined
    });
  }, resolvePolicyCommand)
  .command('resolve-fd-policy <internalId> [--rm <rm-address>]',
           'Triggers resolution of Flight Delay policy', (yargs) => {
    yargs.positional('internalId', {
      type: 'number',
      describe: 'Internal Id of the policy'
    });
    yargs.option("rmAddress", {
      describe: "Address of the RiskModule contract ",
      type: "string",
      default: RM_ADDRESS
    });
  }, resolveFDPolicyCommand)
  .command('fetch-rm-params [--rm <rm-address>]',
           'Fetch Risk Module Params', (yargs) => {
    yargs.option("rmAddress", {
      describe: "Address of the RiskModule contract ",
      type: "string",
      default: RM_ADDRESS
    });
    yargs.option("rmType", {
      describe: "Type of RiskModule",
      default: "SignedQuoteRiskModule"
    });
    yargs.option("outputFile", {
      type: "string",
      describe: "Output file where the rm parameters will be saved (json). Default stdout",
      default: "-"
    });
  }, fetchRMParamsCommand)
  .command('compute-premium <payout> <lossProb> <expiration>',
           'Fetch Risk Module Params', (yargs) => {
    yargs.positional('payout', {
      describe: "maximum payout of the policy",
      type: 'number',
    });
    yargs.positional('lossProb', {
      describe: "Probability of paying the maximum payout (lossProb * payout = expectedLoss)",
      type: 'number',
    });
    yargs.positional('expiration', {
      describe: "Policy expiration (relative in days if <1000, unix timestamp, else relative in seconds)",
      type: 'number',
    });
    yargs.option("rmAddress", {
      describe: "Address of the RiskModule contract ",
      type: "string",
    });
    yargs.option("rmParams", {
      describe: "Json file with the Risk Module Params",
      type: "string",
    });
    yargs.option("rmType", {
      describe: "Type of RiskModule",
      default: "SignedQuoteRiskModule"
    });
    yargs.option("outputFile", {
      type: "string",
      describe: "Output file where the rm parameters will be saved (json). Default stdout",
      default: "-"
    });
  }, computePremium)
  .command('print-total-supply [--etk-address etk-address]', 'Print EToken Total Supply', (yargs) => {
    yargs.option("etkAddress", {
      describe: "EToken Address",
      type: "string",
    });
  }, printTotalSupply)
  .command('approve [--erc20Address address] [--spender address]', 'ERC20 Approval', (yargs) => {
    yargs.option("erc20Address", {
      describe: "ERC20 contract Address",
      type: "string",
      default: "0x9aa7fEc87CA69695Dd1f879567CcF49F3ba417E2",
    });
    yargs.option("spender", {
      describe: "Spender Address",
      type: "string",
    });
    yargs.option("approvalLimit", {
      describe: "ERC20 contract Address",
      type: "string",
      default: ethers.constants.MaxUint256,
    });
  }, approve)
  .command('faucet [--faucet-contract address]', 'Ask money to the faucet contract (only testnet)', (yargs) => {
    yargs.option("faucetContract", {
      describe: "Address of the Faucet contract that implements `tap` function",
      type: "string",
      default: "0x79E8FEb6e99204858F62C1EFcE607ec279E6c4CA",
    });
  }, faucet)
  .help()
  .argv;
