/* eslint-disable no-undef, import/no-nodejs-modules */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {selectTestsForGroup, toRepoRelativePath} from './shard-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CWD = process.cwd();
const BALANCE_RESULTS_PATH = path.resolve(__dirname, 'vitest-balance.json');
const VITEST_BIN = path.resolve(
  CWD,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'vitest.cmd' : 'vitest'
);

/**
 * @returns {string[]}
 */
function listVitestTests() {
  const result = spawnSync(VITEST_BIN, ['list', '--json', '--filesOnly', '--run'], {
    stdio: 'pipe',
    encoding: 'utf-8',
  });
  if (result.status !== 0) {
    throw new Error(`vitest list failed:\n${result.stderr ?? ''}`);
  }

  /** @type {{file: string}[]} */
  const listed = JSON.parse(result.stdout);

  return listed.map(entry => entry.file).map(file => toRepoRelativePath(file, CWD));
}

/**
 * @returns {Record<string, number> | null}
 */
function loadBalance() {
  if (!fs.existsSync(BALANCE_RESULTS_PATH)) {
    return null;
  }

  const content = fs.readFileSync(BALANCE_RESULTS_PATH, 'utf-8');
  return JSON.parse(content);
}

function main() {
  const nodeTotal = Number(process.env.CI_NODE_TOTAL);
  const nodeIndex = Number(process.env.CI_NODE_INDEX);

  const allTests = listVitestTests();
  const balance = loadBalance();
  const selected = selectTestsForGroup(nodeIndex, nodeTotal, allTests, balance);

  const absoluteSelected = selected.map(test => path.resolve(CWD, `.${test}`));
  const shardLabel = `${nodeIndex + 1}/${nodeTotal}`;
  process.stderr.write(
    `Selected Vitest shard ${shardLabel} with ${absoluteSelected.length} test files\n`
  );
  process.stdout.write(`${absoluteSelected.join('\n')}\n`);
}

main();
