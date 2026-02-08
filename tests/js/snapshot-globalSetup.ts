import {setBrowserServer} from './snapshot-browserState';

export default async function globalSetup() {
  const {chromium} = await import('playwright');
  const server = await chromium.launchServer({
    args: ['--font-render-hinting=none', '--disable-skia-runtime-opts'],
  });
  setBrowserServer(server);
  process.env.__SNAPSHOT_BROWSER_WS__ = server.wsEndpoint();
}
