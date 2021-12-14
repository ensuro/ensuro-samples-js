var fs = require('fs');

var dict = {
    'id': 0,
    'payout': 0,
    'premium': 0,
    'scr': 0,
    'lossProb': 0,
    'purePremium': 0,
    'premiumForEnsuro': 0,
    'premiumForRm': 0,
    'premiumForLps': 0,
    'address': 0,
    'start': 0,
    'expiration': 0,
}

function parsePolicyData(data){
    id = data.substring(0,66);
    // id = parseInt(id, 16);
    policyId = parseInt(id, 16);
    dict.id = id

    payout = '0x' + data.substring(66,130);
    // payout = parseInt(payout, 16);
    dict.payout = payout

    premium = '0x' + data.substring(130,194);
    // premium = parseInt(premium, 16);
    dict.premium = premium


    scr = '0x' + data.substring(194,258);
    // scr = parseInt(scr, 16);
    dict.scr = scr


    lossProb = '0x' + data.substring(258,322);
    // lossProb = parseInt(lossProb, 16);
    dict.lossProb = lossProb

    
    purePremium = '0x' + data.substring(322,386);
    // purePremium = parseInt(purePremium, 16);
    dict.purePremium = purePremium


    premiumForEnsuro = '0x' + data.substring(386,450);
    // premiumForEnsuro = parseInt(premiumForEnsuro, 16);
    dict.premiumForEnsuro = premiumForEnsuro


    premiumForRm = '0x' + data.substring(450,514);
    // premiumForRm = parseInt(premiumForRm, 16);
    dict.premiumForRm = premiumForRm


    premiumForLps = '0x' + data.substring(514,578);
    // premiumForLps = parseInt(premiumForLps, 16);
    dict.premiumForLps = premiumForLps


    address = '0x' + data.substring(578,642);
    dict.address = address

    start = '0x' + data.substring(642,706);
    // start = parseInt(start, 16);
    dict.start = start

    expiration = '0x' + data.substring(706,770);
    // expiration = parseInt(expiration, 16);
    dict.expiration = expiration

    fs.writeFile("./PolicyData-"+policyId+".json", JSON.stringify(dict, null, 4), (err) => {
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

function parsePolicy(data){
    var test = []
    var d = {}
    var start = 2 
    var k = 0;   
    for (var i = 2; i < data.length; i+= 64) {
        if( k == 9){
            test.push('0x' + data.substring(start+24,start+64));
        }
        else if (k > 9){
            test.push('0x' + data.substring(start+54,start+64));
        }
        else {
            test.push('0x' + data.substring(start,start+64));
        }
        start +=64;
        k++;
    }
    d.data = test;
    policyId = parseInt(d.data[0], 16);
    fs.writeFile("./PolicyData-"+policyId+".json", JSON.stringify(d, null, 4), (err) => {
        if (err) {  console.error(err);  return; };
    });
}


module.exports = {parsePolicy, parsePolicyData, readData, getArgs };

