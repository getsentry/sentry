import {browserServer} from './snapshot-browserState';

export default async function globalTeardown() {
  await browserServer?.close();
}
