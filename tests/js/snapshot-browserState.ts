import type {BrowserServer} from 'playwright';

export let browserServer: BrowserServer | null = null;

export function setBrowserServer(server: BrowserServer) {
  browserServer = server;
}
