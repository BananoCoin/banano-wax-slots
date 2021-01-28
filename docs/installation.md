# installation

## https

enabling https is reccomended

     use lighttpd as a reverse proxy and letsencrypt certbot to configure https

     https://letsencrypt.org/getting-started/

     https://stackoverflow.com/questions/4859956/lighttpd-as-reverse-proxy

## requirements

nodejs is required

      https://nodejs.org/en/download/

on ubuntu, screen is required

    sudo apt install screen

## setup git to cache password

this step is optional.

    git config --global credential.helper store

## download the repo.

    git clone https://github.com/BananoCoin/banano-wax-slots.git

## next install the code

    npm install;

## set up the config file

run the below command "new-config" to generate a new config to be used to create the wallets.

    npm run new-config;

then create a file called 'config.json'

    touch config.json;

then edit the file (vi config.json or nano config.json) and paste the new config.

    ```js
    {
      "cookieSecret": "<hex>",
      "waxIdSeed": "<hex>",
      "centralWalletSeed": "<hex>",
      "burnAccount": "crptomonkeys"
    }
    ```

## run the bot

run the bot inside screen (so it won't die when you log out)

    npm run screenstart;

type control-a d to exit screen.

## alternate way to run the bot

if you want to run it in the background without checking if it started correctly, run the screen command headless

    screen -dmSL banano_wax_slots npm start
