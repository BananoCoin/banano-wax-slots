'use strict';
import {connect} from 'socket.io-client';
import {readFile} from 'node:fs/promises';

const run = async () => {
  const CONFIG_URL = new URL('../config.json', import.meta.url);
  const config = JSON.parse(await readFile(CONFIG_URL, 'utf8'));
  const webPort = config.web.port;

  if (webPort == undefined) {
    throw Error('webPort is required in ./config.json');
  }

  const url = `http://localhost:${webPort}`;

  const socketClient = connect(url, {
    timeout: 30000,
  });

  const timeoutErrorFn = () => {
    console.log('timeout error, cannot connnect to url', url);
    process.exit(0);
  };

  const timeoutId = setTimeout(timeoutErrorFn, 30000);

  const acknCallbackFn = function(err, userData) {
    clearTimeout(timeoutId);
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };

  socketClient.on('connect', () => {
    socketClient.emit('npmStop', acknCallbackFn);
  });
  socketClient.on('disconnect', acknCallbackFn);
};
run();
