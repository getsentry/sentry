/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const child_process = require('child_process');
const fs = require('fs');
const path = require('path');

const DOCS_INDEX_PATH = 'src/sentry/integration-docs/_platforms.json';

class BuildIntegrationDocs {
  constructor({basePath}) {
    this.modulePath = path.join(basePath, DOCS_INDEX_PATH);
  }

  apply(compiler) {
    compiler.hooks.beforeRun.tapAsync(
      'BuildIntegrationDocs',
      (_compilation, callback) => {
        const moduleDir = path.dirname(this.modulePath);
        if (!fs.existsSync(moduleDir)) {
          fs.mkdirSync(moduleDir, {recursive: true});
        }
        if (!fs.existsSync(this.modulePath)) {
          child_process.execSync('make build-platform-assets');
          callback();
        } else {
          callback();
        }
      }
    );
  }
}

module.exports = BuildIntegrationDocs;
