'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Jest balance reporter that writes test timing data to a JSON file
 * @param {Object} results - Jest test results object
 * @param {boolean} results.success - Whether all tests passed
 * @param {Array<{testFilePath: string, perfStats: {runtime: number}}>} results.testResults - Array of test result objects
 * @returns {Object} The original results object
 */
function writeReport(results) {
  if (!results.success) {
    throw new Error('Balance reporter requires all tests to succeed.');
  }

  const cwd = process.cwd();
  /** @type {Record<string, number>} */
  const testValues = {};

  for (const test of results.testResults) {
    testValues[test.testFilePath.replace(cwd, '')] = test.perfStats.runtime;
  }

  fs.writeFileSync(
    path.resolve(__dirname, 'jest-balance.json'),
    JSON.stringify(testValues, null, '\t')
  );

  return results;
}

module.exports = writeReport;
