import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

import type {AggregatedResult} from '@jest/test-result';

export default function writeReport(results: AggregatedResult): AggregatedResult {
  const cwd = process.cwd();
  const testValues: Record<string, number> = {};

  for (const test of results.testResults) {
    if (test.numFailingTests > 0) {
      continue;
    }
    testValues[test.testFilePath.replace(cwd, '')] = test.perfStats.runtime;
  }

  writeFileSync(
    resolve(import.meta.dirname, 'jest-balance.json'),
    JSON.stringify(testValues, null, '\t')
  );

  return results;
}
