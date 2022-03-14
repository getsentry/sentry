/* eslint-env node */
/* eslint import/no-nodejs-modules:0 */
const fs = require('fs').promises;

class TestBalancer {
  constructor(globalConfig, options) {
    this._globalConfig = globalConfig;
    this._options = options;

    this.results = new Map();
  }

  onTestFileResult(test) {
    const path = test.path.replace(this._globalConfig.rootDir, '');
    this.results.set(path, test.duration);
  }

  onRunComplete(_contexts, results) {
    // results.success always returns false for me?
    if (
      results.numTotalTests === 0 ||
      results.numFailedTests > 0 ||
      !this._options.enabled ||
      !this._options.resultsPath
    ) {
      return;
    }

    const data = JSON.stringify(Object.fromEntries(this.results), null, 2);
    fs.writeFile(this._options.resultsPath, data);
  }
}

module.exports = TestBalancer;
