/* eslint-disable no-undef, import/no-nodejs-modules */
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {toRepoRelativePath} from './shard-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = path.resolve(
  process.cwd(),
  '.artifacts',
  'vitest-balance-report.json'
);
const BALANCE_PATH = path.resolve(__dirname, 'vitest-balance.json');

function runVitestForTiming() {
  const extraArgs = process.argv.slice(2);
  execFileSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'run',
      '--maxWorkers=100%',
      '--reporter=json',
      `--outputFile=${REPORT_PATH}`,
      ...extraArgs,
    ],
    {
      stdio: 'inherit',
    }
  );
}

/**
 * @param {any} report
 * @returns {Record<string, number>}
 */
function extractTimingMap(report) {
  if (!report || typeof report !== 'object') {
    throw new Error('Invalid vitest JSON report');
  }
  if (!report.success) {
    throw new Error('Vitest balance generation requires all tests to pass');
  }
  if (!Array.isArray(report.testResults)) {
    throw new Error('Vitest JSON report missing testResults array');
  }

  const cwd = process.cwd();
  /** @type {Record<string, number>} */
  const timingMap = {};

  for (const suite of report.testResults) {
    const filePath = typeof suite.name === 'string' ? suite.name : null;
    if (!filePath) {
      continue;
    }

    const startTime = Number(suite.startTime);
    const endTime = Number(suite.endTime);
    const runtime =
      Number.isFinite(startTime) && Number.isFinite(endTime) ? endTime - startTime : 0;
    timingMap[toRepoRelativePath(filePath, cwd)] = Math.max(1, Math.round(runtime));
  }

  if (Object.keys(timingMap).length === 0) {
    throw new Error('No suite timing data found in vitest JSON report');
  }

  return timingMap;
}

function main() {
  runVitestForTiming();

  const reportRaw = fs.readFileSync(REPORT_PATH, 'utf-8');
  const report = JSON.parse(reportRaw);
  const timingMap = extractTimingMap(report);

  fs.writeFileSync(BALANCE_PATH, JSON.stringify(timingMap, null, '\t'));
  process.stdout.write(
    `Wrote ${Object.keys(timingMap).length} entries to ${BALANCE_PATH}\n`
  );
}

main();
