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

0.  figure out why you can still play with a zero balance.
1.  add withdraw button
2.  add anchor login <https://github.com/greymass/anchor-link>
