/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const path = require('path');
const fs = require('fs');

class LastBuiltPlugin {
  constructor({basePath}) {
    this.basePath = basePath;
  }

  apply(compiler) {
    compiler.hooks.done.tapAsync('LastBuiltPlugin', (_compilation, callback) => {
      fs.writeFile(
        path.join(this.basePath, '.webpack.meta'),
        JSON.stringify({
          built: new Date(new Date().toUTCString()).getTime(),
        }),
        callback
      );
    });
  }
}
module.exports = LastBuiltPlugin;
