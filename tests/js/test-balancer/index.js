/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */
const fs = require('fs');
const path = require('path');

const BALANCE_RESULTS_PATH = path.resolve(__dirname, 'jest-balance.json');
module.exports.BALANCE_RESULTS_PATH = BALANCE_RESULTS_PATH;

module.exports = results => {
  if (!results.success) {
    throw new Error('Balance reporter requires all tests to succeed.');
  }

  const cwd = process.cwd();
  const testValues = {};

  for (const test of results.testResults) {
    testValues[test.testFilePath.replace(cwd, '')] = test.perfStats.runtime;
  }

  fs.writeFileSync(BALANCE_RESULTS_PATH, JSON.stringify(testValues));

  return results;
};
