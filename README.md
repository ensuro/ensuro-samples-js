# Ensuro Samples

Samples for using Ensuro protocol.

Environment variables:

```
export RELAY_API_KEY=<defender-api-key>
export RELAY_API_SECRET=<defender-api-secret>
export RM_ADDRESS=<address-of-risk-module>
```


## TrustfullRiskModule

With this kind of RiskModule, the creation and the resolution of the policy is done trusting authorized users.

The account (or relay account) must have the role PRICER_ROLE to create policies and RESOLVER_ROLE to resolve.

```bash

npm install
node cli.js new-policy 1234 sample-policy.json <customer-address>
node cli.js resolve-policy PolicyData-1234.json true
```

The `<customer-address>` is the address that will pay the premium and receive the payout. To be able to pay the premium, before the creation of the policy the customer needs to `approve` the spending of the currency to the pool address. (see https://medium.com/ethex-market/erc20-approve-allow-explained-88d6de921ce9) . This approval might be infinite if you don't want to issue an approval transaction before each policy, the pool anyway will only spend the amount indicated in the `premium` parameter.

### Policy parameters

The policy parameters are sent in the JSON file (if using the CLI or as function parameters if using ensuro.js)

```
{
  "payout": 110.0,  // Amount of the payout in USD
  "premium": 12.0,  // Amount of the premium
  "lossProb": 0.08,  // Probability of payout - 0.08 == 8%
  "expiration": 3600  // Expiration as relative time, can also be send as absolute epoch timestamp
}
```

## FlightDelayRiskModule

In this module the policies are resolved automatically using a Chainlink oracle. When the policy is created, a job is scheduled in Chainlink to be run at `expectedArribal + tolerance + 120` that will call FlightAware API to verify if the flight arrived on time or not.

Besides this scheduled job, you can force the resolution of the policy (uses the same oracle, but doesn't wait) with the `resolve-fd-policy` command or calling `ensuro.resolveFlightDelayPolicy` javascript function.

```bash
npm install
node cli.js new-policy 1234 sample-flight-delay-policy.json <customer-address>
node cli.js resolve-fd-policy 1234
```

### Policy parameters

The policy parameters are sent in the JSON file (if using the CLI or as function parameters if using ensuro.js)

```
{
  "flight": "UAL488",  // Flight airline and number
  "departure": 1641481200,  // Filed departure date (this two parameters identify the flight)
  "expectedArrival": 1641486660,
  "tolerance": 7200,  // In seconds - if (actualArribal - expectedArrival) > tolerance ==> payout
  "payout": 110.0,  // Amount of the payout in USD
  "premium": 12.0,  // Amount of the premium
  "lossProb": 0.08,  // Probability of payout - 0.08 == 8%
}
```
