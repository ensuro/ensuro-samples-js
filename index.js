#!/usr/bin/env node

const { DefenderRelaySigner, DefenderRelayProvider } = require('defender-relay-client/lib/ethers');
const { ethers } = require('ethers');

const { abi } = require("./abis/TrustfulRiskModule.json");

// const credentials = { apiKey: YOUR_API_KEY, apiSecret: YOUR_API_SECRET };
const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;

const PRICER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PRICER_ROLE"));
const RESOLVER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RESOLVER_ROLE"));
// const NEW_POLICY_EVENT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("NewPolicy(address,uint256)"));
const NEW_POLICY_EVENT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(
    "NewPolicy(address,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,uint40,uint40))"
));

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

const newPolicy = async (payout, premium, lossProb, expiration, customer, rm) => {
    const tx = await rm.newPolicy(payout, premium, lossProb, expiration, customer, 
        {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the 
                           // transaction - remove in production
    );
    console.log(`Transaction created: ${tx.hash}`);
    const receipt = await tx.wait();
    // const parsedEvents = receipt.logs.filter(e => rm.interface.parseLog(e));
    // console.log(parsedEvents);
    const events = receipt.logs.filter(e => e.topics[0] === NEW_POLICY_EVENT);
    console.log(events);
    console.log(`Created policyData is ${events[0].data}`);
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
const rm = new ethers.Contract("0xD6F5494e724bAeD8ABD48D296Ac06FbF98f4566e", abi, signer);
(async ()=>{
    // await newPolicy(_W(400), _W(60), _R(0.11), 1640898016, "0x539fe6aD90931e02F902618d0e33D326F670B89C", rm);
    // return;
    const policyData = "0x00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000017d7840000000000000000000000000000000000000000000000000000000000039387000000000000000000000000000000000000000000000000000000000004f605000000000000000000000000000000000000000000005afd67f2dc0e1b2e00000000000000000000000000000000000000000000000000000000000000035ebb6000000000000000000000000000000000000000000000000000000000001bb196000000000000000000000000000000000000000000000000000000000014512a000000000000000000000000000000000000000000000000000000000004c8e0000000000000000000000000d6f5494e724baed8abd48d296ac06fbf98f4566e0000000000000000000000000000000000000000000000000000000061b53fab0000000000000000000000000000000000000000000000000000000061ce1de0";
    const policyDataFields = ['0x0000000000000000000000000000000000000000000000000000000000000002', '0x0000000000000000000000000000000000000000000000000000000017d78400', '0x0000000000000000000000000000000000000000000000000000000003938700', '0x0000000000000000000000000000000000000000000000000000000004f60500', '0x0000000000000000000000000000000000000000005afd67f2dc0e1b2e000000', '0x00000000000000000000000000000000000000000000000000000000035ebb60', '0x00000000000000000000000000000000000000000000000000000000001bb196', '0x000000000000000000000000000000000000000000000000000000000014512a', '0x000000000000000000000000000000000000000000000000000000000004c8e0', '0xd6f5494e724baed8abd48d296ac06fbf98f4566e', '0x0061b53fab', '0x0061ce1de0'];
/*    await resolve([
        2,  // policy_id
        _W(400), // = "0x0000000000000000000000000000000000000000000000000000000017d78400", - payout
        _W(60), // = "0x0000000000000000000000000000000000000000000000000000000000039387 - premium
        "0x000000000000000000000000000000000000000000000000000000000004f605", // scr
        _R(0.11), // = 000000000000000000000000000000000000000000005afd67f2dc0e1b2e - lossProb
        "00000000000000000000000000000000000000000000000000000000000000035ebb6
        ...
      ], true, rm);*/
/* Python Script to transform hex policyData into the parameters that need to be sent to resolve

$ python
Python 3.8.10 (default, Sep 28 2021, 16:10:42) 
[GCC 9.3.0] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> policyData = "00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000017d7840000000000000000000000000000000000000000000000000000000000039387000000000000000000000000000000000000000000000000000000000004f605000000000000000000000000000000000000000000005afd67f2dc0e1b2e00000000000000000000000000000000000000000000000000000000000000035ebb6000000000000000000000000000000000000000000000000000000000001bb196000000000000000000000000000000000000000000000000000000000014512a000000000000000000000000000000000000000000000000000000000004c8e0000000000000000000000000d6f5494e724baed8abd48d296ac06fbf98f4566e0000000000000000000000000000000000000000000000000000000061b53fab0000000000000000000000000000000000000000000000000000000061ce1de0"
>>> fields = "uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,uint40,uint40".split(",")
>>> hexsize = {"uint256": 64, "uint40": 10, "address": 40}
>>> start = 0
>>> ret = []
>>> for field in fields:
...     ret.append("0x" + policyData[start + 64 - hexsize[field]: start + 64])
...     start += 64
... 
>>> ret
['0x0000000000000000000000000000000000000000000000000000000000000002', '0x0000000000000000000000000000000000000000000000000000000017d78400', '0x0000000000000000000000000000000000000000000000000000000003938700', '0x0000000000000000000000000000000000000000000000000000000004f60500', '0x0000000000000000000000000000000000000000005afd67f2dc0e1b2e000000', '0x00000000000000000000000000000000000000000000000000000000035ebb60', '0x00000000000000000000000000000000000000000000000000000000001bb196', '0x000000000000000000000000000000000000000000000000000000000014512a', '0x000000000000000000000000000000000000000000000000000000000004c8e0', '0xd6f5494e724baed8abd48d296ac06fbf98f4566e', '0x0061b53fab', '0x0061ce1de0']

*/
    await resolve(policyDataFields, true, rm);
})();
