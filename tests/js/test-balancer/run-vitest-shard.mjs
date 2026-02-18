import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {selectTestsForGroup, toRepoRelativePath} from './shard-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BALANCE_RESULTS_PATH = path.resolve(__dirname, 'vitest-balance.json');

/**
 * @returns {string[]}
 */
function listVitestTests() {
  const stdout = execFileSync(
    'pnpm',
    ['exec', 'vitest', 'list', '--json', '--filesOnly', '--run'],
    {
      stdio: 'pipe',
      encoding: 'utf-8',
    }
  );
  const listed = JSON.parse(stdout);
  if (!Array.isArray(listed)) {
    throw new Error('Unexpected output from `vitest list --json --filesOnly`');
  }

  const cwd = process.cwd();
  return listed
    .map(entry => (entry && typeof entry.file === 'string' ? entry.file : null))
    .filter(Boolean)
    .map(file => toRepoRelativePath(file, cwd));
}

/**
 * @returns {Record<string, number> | null}
 */
function loadBalance() {
  if (!fs.existsSync(BALANCE_RESULTS_PATH)) {
    return null;
  }

  const content = fs.readFileSync(BALANCE_RESULTS_PATH, 'utf-8');
  const parsed = JSON.parse(content);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid vitest balance JSON: expected object map');
  }
  return parsed;
}

function main() {
  const {CI_NODE_TOTAL, CI_NODE_INDEX} = process.env;
  if (typeof CI_NODE_TOTAL === 'undefined' || typeof CI_NODE_INDEX === 'undefined') {
    throw new Error('CI_NODE_TOTAL and CI_NODE_INDEX are required');
  }

  const nodeTotal = Number(CI_NODE_TOTAL);
  const nodeIndex = Number(CI_NODE_INDEX);
  if (!Number.isInteger(nodeTotal) || nodeTotal <= 0) {
    throw new Error(`Invalid CI_NODE_TOTAL: ${CI_NODE_TOTAL}`);
  }
  if (!Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= nodeTotal) {
    throw new Error(`Invalid CI_NODE_INDEX: ${CI_NODE_INDEX}`);
  }

  const allTests = listVitestTests();
  if (allTests.length === 0) {
    throw new Error('No vitest tests were discovered for sharding');
  }

  const balance = loadBalance();
  const selected = selectTestsForGroup(nodeIndex, nodeTotal, allTests, balance);
  if (selected.length === 0) {
    throw new Error(`Shard ${nodeIndex}/${nodeTotal} did not receive any tests`);
  }

  const absoluteSelected = selected.map(test => path.resolve(process.cwd(), `.${test}`));
  const shardLabel = `${nodeIndex + 1}/${nodeTotal}`;
  process.stdout.write(
    `Running Vitest shard ${shardLabel} with ${absoluteSelected.length} test files\n`
  );

  execFileSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      '--reporter=default',
      '--reporter=junit',
      '--outputFile=.artifacts/vitest.junit.xml',
      ...absoluteSelected,
    ],
    {stdio: 'inherit'}
  );
}

main();
