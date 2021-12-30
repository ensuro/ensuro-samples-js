# Ensuro Samples

Samples for using Ensuro protocol.

Environment variables:

```
export API_KEY=<defender-api-key>
export API_SECRET=<defender-api-secret>
export RM_ADDRESS=<address-of-risk-module>
```

```bash

npm install
node cli.js new-policy sample-policy.json <customer-address>
node cli.js resolve-policy PolicyData-1234.json true
```
