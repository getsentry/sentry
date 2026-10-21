import {mkdirSync, writeFileSync} from 'node:fs';
import {relative, resolve, sep} from 'node:path';

import type {AggregatedResult} from '@jest/test-result';

/**
 * @public Jest loads this callback through --testResultsProcessor in
 * .github/workflows/jest-balance.yml; Knip does not track that CLI argument.
 */
export default function writeReport(results: AggregatedResult): AggregatedResult {
  const rootDir = resolve(import.meta.dirname, '../../..');
  const workspace = relative(rootDir, process.cwd()).split(sep).join('/') || 'root';
  const reportDirectory = resolve(rootDir, '.artifacts/jest-balance');
  const testValues: Record<string, number> = {};

  for (const test of results.testResults) {
    if (test.numFailingTests > 0) {
      continue;
    }
    const testPath = relative(rootDir, test.testFilePath).split(sep).join('/');
    testValues['/' + testPath] = test.perfStats.runtime;
  }

  mkdirSync(reportDirectory, {recursive: true});
  writeFileSync(
    resolve(reportDirectory, encodeURIComponent(workspace) + '.json'),
    JSON.stringify(testValues, null, '\t')
  );

  return results;
}
