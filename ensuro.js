const { DefenderRelaySigner, DefenderRelayProvider } = require('defender-relay-client/lib/ethers');
const { ethers } = require('ethers');

const helper = require('./helper.js');
const _BN = ethers.BigNumber.from;
const WAD = _BN(1e10).mul(_BN(1e8));  // 1e10*1e8=1e18
const RAY = WAD.mul(_BN(1e9));  // 1e18*1e9=1e27

const PRICER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("PRICER_ROLE"));
const RESOLVER_ROLE = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("RESOLVER_ROLE"));
const NEW_POLICY_EVENT = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(
    "NewPolicy(address,(uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256,address,uint40,uint40))"
));

function _W(value){
    if (ethers.BigNumber.isBigNumber(value)){
        return value;
    }
    if (!Number.isInteger(value))
        return _BN(Math.round(value * 1e6));
    return _BN(value).mul(_BN(1e6));
}
    
function _R(value){
    if (ethers.BigNumber.isBigNumber(value)){
        return value;
    }
    if (!Number.isInteger(value))
        return _BN(value * 1e9).mul(WAD);
    return _BN(value).mul(RAY);
}

async function newPolicy(data, customer, rm){
    const tx = await rm.newPolicy(_W(data.payout), _W(data.premium), _R(data.lossProb), data.expiration, customer, 
        {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the 
                            // transaction - remove in production
    );
    console.log(`Transaction created: ${tx.hash}`);

    const receipt = await tx.wait();
    const events = receipt.logs.filter(e => e.topics[0] === NEW_POLICY_EVENT);

    policy = helper.parsePolicyData(events[0].data);
    helper.writePolicyData(policy);
    return events[0].data;
}

async function resolve(policyData, customerWon, rm){
    const tx = await rm.resolvePolicyFullPayout(policyData, customerWon, 
        {gasLimit: 999999} // This is to force sending transactions that will fail (to see the error in the 
                            // transaction - remove in production
    );
    console.log(`Transaction created: ${tx.hash}`);
    await tx.wait();
}

function getDefenderRelaySigner(API_KEY, API_SECRET) {
    const credentials = { apiKey: API_KEY, apiSecret: API_SECRET };
    const provider = new DefenderRelayProvider(credentials);
    const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
    return signer;
}


module.exports = {newPolicy, resolve, getDefenderRelaySigner, _W, _R };

