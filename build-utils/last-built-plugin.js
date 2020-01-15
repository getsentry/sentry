/*eslint-env node*/
/*eslint import/no-nodejs-modules:0 */
const path = require('path');
const fs = require('fs');

class LastBuiltPlugin {
  constructor({basePath}) {
    this.basePath = basePath;
    this.isWatchMode = false;
  }

  apply(compiler) {
    compiler.hooks.watchRun.tapAsync('LastBuiltPlugin', (_, callback) => {
      this.isWatchMode = true;
      callback();
    });

    compiler.hooks.done.tapAsync('LastBuiltPlugin', (_, callback) => {
      // If this is in watch mode, then assets will *NOT* be written to disk
      // We only want to record when we write to disk since this plugin is for
      // our acceptance test (which require assets to be on fs)
      if (this.isWatchMode) {
        callback();
        return;
      }

      fs.writeFile(
        path.join(this.basePath, '.webpack.meta'),
        JSON.stringify({
          // in seconds
          built: Math.floor(new Date(new Date().toUTCString()).getTime() / 1000),
        }),
        callback
      );
    });
  }
}
module.exports = LastBuiltPlugin;
