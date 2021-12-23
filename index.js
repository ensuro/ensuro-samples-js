#!/usr/bin/env node

const { ethers } = require('ethers');
const { abi } = require("./abis/TrustfulRiskModule.json");

const API_KEY = process.env.API_KEY;
const API_SECRET = process.env.API_SECRET;
const RM_ADDRESS = process.env.RM_ADDRESS;

const helper = require('./helper.js');
const ensuro = require('./ensuro.js');
const signer = ensuro.getDefenderRelaySigner(API_KEY, API_SECRET);


const rm = new ethers.Contract(RM_ADDRESS, abi, signer);
(async ()=>{

    const args = helper.getArgs();
    if ( args.c != null ){
      console.log("New policy creation begins");
      const data = helper.readData(args.c);
      if ( args.a != null) {
        await ensuro.newPolicy(data, args.a, rm);
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

})();
