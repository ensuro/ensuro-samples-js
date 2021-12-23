const fs = require('fs');

function parsePolicyData(policy){

    let policyData = {}
    let data = []
    let id = policy.substring(0,66);
    policyId = parseInt(id, 16);
    data.push(id);

    let payout = '0x' + policy.substring(66,130);
    data.push(payout);

    let premium = '0x' + policy.substring(130,194);
    data.push(premium);

    let scr = '0x' + policy.substring(194,258);
    data.push(scr);

    let lossProb = '0x' + policy.substring(258,322);
    data.push(lossProb);

    let purePremium = '0x' + policy.substring(322,386);
    data.push(purePremium);

    let premiumForEnsuro = '0x' + policy.substring(386,450);
    data.push(premiumForEnsuro);

    let premiumForRm = '0x' + policy.substring(450,514);
    data.push(premiumForRm);

    let premiumForLps = '0x' + policy.substring(514,578);
    data.push(premiumForLps);

    let address = '0x' + policy.substring(602,642);
    data.push(address);

    let start = '0x' + policy.substring(696,706);
    data.push(start);

    let expiration = '0x' + policy.substring(760,770);
    data.push(expiration);

    policyData.data = data;
    return policyData;
}

function writePolicyData(policyData){
    policyId = parseInt(policyData.data[0], 16);
    fs.writeFile("./PolicyData-"+policyId+".json", JSON.stringify(policyData, null, 4), (err) => {
        if (err) {  console.error(err);  return; };
    });
}

function readData(file){
    var data = JSON.parse(fs.readFileSync(file));
    return data;
}

function getArgs(){
    var arr = {};
    var last;
    process.argv.forEach((a, idx) => {
        if(idx > 1){
            if(last){
                arr[last] = a;
                last = undefined;
            }
            else if(!last && a.match(/-\w+/)){
                last = a.substring(1);
            }
        }
    })
    return arr;
}

function parsePolicy(policy){
    let data = []
    let policyData = {}
    let index = 0;   
    for (var start = 2; start < policy.length; start+= 64) {
        if( index == 9){
            data.push('0x' + policy.substring(start+24,start+64));
        }
        else if (index > 9){
            data.push('0x' + policy.substring(start+54,start+64));
        }
        else {
            data.push('0x' + policy.substring(start,start+64));
        }
        index++;
    }
    policyData.data = data;

    return policyData;
}


module.exports = {parsePolicy, parsePolicyData,writePolicyData, readData, getArgs };

