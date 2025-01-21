'use strict';

const fs = require('node:fs');
const path = require('node:path');

module.exports = results => {
  if (!results.success) {
    throw new Error('Balance reporter requires all tests to succeed.');
  }

  const cwd = process.cwd();
  const testValues = {};

  for (const test of results.testResults) {
    testValues[test.testFilePath.replace(cwd, '')] = test.perfStats.runtime;
  }

  fs.writeFileSync(
    path.resolve(__dirname, 'jest-balance.json'),
    JSON.stringify(testValues)
  );

  return results;
};
