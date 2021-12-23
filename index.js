#!/usr/bin/env node

const { DefenderRelaySigner, DefenderRelayProvider } = require('defender-relay-client/lib/ethers');
const { ethers } = require('ethers');

const { abi } = require("./abis/TrustfulRiskModule.json");

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const RM_ADDRESS = process.env.RM_ADDRESS;

const PRICER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PRICER_ROLE"));
const RESOLVER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RESOLVER_ROLE"));
const NEW_POLICY_EVENT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(
    "NewPolicy(address,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,uint40,uint40))"
));

const helper = require('./helper.js');
const _BN = ethers.BigNumber.from;
const WAD = _BN(1e10).mul(_BN(1e8));  // 1e10*1e8=1e18
const RAY = WAD.mul(_BN(1e9));  // 1e18*1e9=1e27

function _W(value) {
  if (!Number.isInteger(value))
    return _BN(Math.round(value * 1e6));
  return _BN(value).mul(_BN(1e6));
}

function _R(value) {
  if (!Number.isInteger(value))
    return _BN(value * 1e9).mul(WAD);
  return _BN(value).mul(RAY);
}

const getDefenderRelaySigner = (API_KEY, API_SECRET) => {
    const credentials = { apiKey: API_KEY, apiSecret: API_SECRET };
    const provider = new DefenderRelayProvider(credentials);
    const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
    return signer;
}

const newPolicy = async (data, customer, rm) => {
    const tx = await rm.newPolicy(_W(data.payout), _W(data.premium), _R(data.lossProb), data.expiration, customer, 
        {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the 
                           // transaction - remove in production
    );
    console.log(`Transaction created: ${tx.hash}`);

    const receipt = await tx.wait();
    const events = receipt.logs.filter(e => e.topics[0] === NEW_POLICY_EVENT);

    policy = helper.parsePolicy(events[0].data);
    helper.writePolicyData(policy);
    return events[0].data;
}

const resolve = async(policyData, customerWon, rm) => {
    const tx = await rm.resolvePolicyFullPayout(policyData, customerWon, 
        {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the 
                           // transaction - remove in production
    );
    console.log(`Transaction created: ${tx.hash}`);
    await tx.wait();
}

const signer = getDefenderRelaySigner(API_KEY, API_SECRET);
// https://mumbai.polygonscan.com/address/0x8A17DA181E5551FB498fe996c3AA4eFA4bF45EfB#readProxyContract
// const rm = new ethers.Contract("0x8A17DA181E5551FB498fe996c3AA4eFA4bF45EfB", abi, signer);
const rm = new ethers.Contract(RM_ADDRESS, abi, signer);
(async ()=>{

    const args = helper.getArgs();
    if ( args.c != null ){
      console.log("New policy creation begins");
      const data = helper.readData(args.c);
      if ( args.a != null) {
        await newPolicy(data, args.a, rm);
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
      await resolve(data.data, true, rm);
    }

})();
