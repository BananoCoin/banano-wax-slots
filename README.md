# wax-slots

# installation instructions

  [installation instructions](docs/installation.md)

# config

  add a config file with the following information:

```js
{
  "cookieSecret": "<hex string>",
  "waxIdSeed": "<hex string>",
  "centralWalletSeed": "<hex string>",
  "burnAccount": "crptomonkeys"
}
```

## todo

check out minting here:

    https://www.npmjs.com/package/atomicassets

    https://gist.github.com/Vyryn/ea4ae93818c87a57ef63f4056a21de01#file-create_claimlink-py-L51

    https://github.com/EOSIO/eosjs#signature-provider

    https://wax.bloks.io/account/atomictoolsx?tab=ABI&account=atomictoolsx

## add user so you aren't running as root

  adduser waxslots;

  su - waxslots;

# run the following command to start:

  npm start;

## to run in background, use the command:

  npm run screenstart;

## to stop, use the command:

  npm stop;

### to stop and restart, use the command:

  npm run screenrestart;

### todo
- make faq linkable.
- add ability to disable sounds
- add ability to check for nonce in the blockchain, to not spend so much on securerand.
