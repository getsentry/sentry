'use strict';

import {spawn} from 'node:child_process';
import * as net from 'node:net';
import * as readline from 'node:readline';

const DEFAULT_PORT = parseInt(process.env.SENTRY_WEBPACK_PROXY_PORT ?? '7999', 10);
const MAX_PORT_SEARCH = 10;

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port);
  });
}

async function findNextPort(from: number): Promise<number | null> {
  for (let i = 0; i < MAX_PORT_SEARCH; i++) {
    if (await isPortAvailable(from + i)) {
      return from + i;
    }
  }
  return null;
}

function ask(question: string): Promise<boolean> {
  const rl = readline.createInterface({input: process.stdin, output: process.stdout});
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === '' || normalized === 'y' || normalized === 'yes');
    });
  });
}

function startServer(port: number): void {
  const child = spawn('rspack', ['serve'], {
    env: {...process.env, SENTRY_WEBPACK_PROXY_PORT: String(port)},
    stdio: 'inherit',
  });
  child.on('close', code => process.exit(code ?? 0));
}

async function main(): Promise<void> {
  const requestedPort = DEFAULT_PORT;

  if (await isPortAvailable(requestedPort)) {
    startServer(requestedPort);
    return;
  }

  const availablePort = await findNextPort(requestedPort + 1);

  if (availablePort === null) {
    process.stderr.write(
      `All ports in range ${requestedPort}–${requestedPort + MAX_PORT_SEARCH} are in use.\n`
    );
    process.exit(1);
  }

  const confirmed = await ask(
    `Port ${requestedPort} is already in use. Start on port ${availablePort} instead? [Y/n] `
  );

  if (!confirmed) {
    process.exit(0);
  }

  startServer(availablePort);
}

main();
