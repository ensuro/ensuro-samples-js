#!/usr/bin/env node

const { ethers } = require('ethers');
const { abi } = require("./abis/TrustfulRiskModule.json");
const fs = require('fs');

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const RM_ADDRESS = process.env.RM_ADDRESS;

const yargs = require('yargs');
const ensuro = require('./ensuro.js');
const signer = ensuro.getDefenderRelaySigner(API_KEY, API_SECRET);

async function newPolicyCommand(argv) {
  const rm = new ethers.Contract(argv.rmAddress, abi, signer);
  const policyData = JSON.parse(fs.readFileSync(argv.policyData));
  const tx = await ensuro.newPolicy(policyData, argv.customer, rm);
  // The transaction was sent to the blockchain, might take sometime to approve, to
  // avoid sending duplicated policies, it's better to save the {tx.hash} and check asyncronously
  // the result of the transaction
  const receipt = await tx.wait();
  const createPolicyData = ensuro.decodeNewPolicyReceipt(receipt);
  console.log(`New Policy was created with id: ${createPolicyData.id}`);
  const outputFile = argv.outputFile || `./PolicyData-${createPolicyData.id}.json`;
  fs.writeFile(outputFile, JSON.stringify(createPolicyData, null, 4), (err) => {
        if (err) {  console.error(err);  return; };
  });
}

yargs.scriptName("ensuro-cli")
  .usage('$0 <cmd> [args]')
  .command('new-policy <policyData> <customer> [--rm <rm-address>]', 'Create new policy', (yargs) => {
    yargs.positional('policyData', {
      type: 'string',
      describe: 'Json file with the data of the policy to be created - See sample-policy.json'
    });
    yargs.positional('customer', {
      type: 'string',
      describe: 'Address that pays the premium and receives the payout'
    });
    yargs.option("rmAddress", {
      describe: "Address of the RiskModule contract ",
      default: RM_ADDRESS
    });
    yargs.option("outputFile", {
      describe: "Output file where the policy data will be saved (json)",
    });
  }, newPolicyCommand)
  .help()
  .argv;

/*

(async ()=>{

    const args = yargs.argv;
    if ( args.c != null ){
      console.log("New policy creation begins");
      const data = helper.readData(args.c);
      if ( data.address != null) {
        await ensuro.newPolicy(data, data.address, rm);
        return;
      }
      else{
        console.log("You must send the address.")
        return;
      }
    }
    else if ( args.r != null ) {
      console.log("Policy resolution begins");
      const data = helper.readData(args.r);
      await ensuro.resolve(data.data, true, rm);
    }

})();*/
