'use strict';

import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

/**
 * Jest balance reporter that writes test timing data to a JSON file
 * @param {Object} results - Jest test results object
 * @param {boolean} results.success - Whether all tests passed
 * @param {Array<{testFilePath: string, perfStats: {runtime: number}}>} results.testResults - Array of test result objects
 * @returns {Object} The original results object
 */
export default function writeReport(results) {
  if (!results.success) {
    throw new Error('Balance reporter requires all tests to succeed.');
  }

  const cwd = process.cwd();
  /** @type {Record<string, number>} */
  const testValues = {};

  for (const test of results.testResults) {
    testValues[test.testFilePath.replace(cwd, '')] = test.perfStats.runtime;
  }

  writeFileSync(
    resolve(import.meta.dirname, 'jest-balance.json'),
    JSON.stringify(testValues, null, '\t')
  );

  return results;
}
