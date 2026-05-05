import {spawn} from 'node:child_process';
import * as net from 'node:net';

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

async function findNextPort(
  from: number
): Promise<{port: number | null; takenPorts: number[]}> {
  const takenPorts: number[] = [];
  for (let i = 0; i < MAX_PORT_SEARCH; i++) {
    if (await isPortAvailable(from + i)) {
      return {port: from + i, takenPorts};
    }
    takenPorts.push(from + i);
  }
  return {port: null, takenPorts};
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
  const {port: availablePort, takenPorts} = await findNextPort(requestedPort);

  if (availablePort === null) {
    process.stderr.write(
      `All ports in range ${requestedPort}–${requestedPort + MAX_PORT_SEARCH - 1} are in use.\n`
    );
    process.exit(1);
  }

  if (availablePort !== requestedPort) {
    process.stderr.write(
      `Ports ${takenPorts.join(', ')} already in use. Starting on port ${availablePort} instead.\n`
    );
  }

  startServer(availablePort);
}

main();
