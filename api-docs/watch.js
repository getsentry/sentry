/* eslint-env node */
/* eslint import/no-nodejs-modules:0 no-console:0 */

const sane = require('sane');
const {execSync} = require('child_process');

const watcherPy = sane('src/sentry');
const watcherJson = sane('api-docs');

const watchers = [watcherPy, watcherJson];

const makeApiDocsCommand = function () {
  console.log('rebuilding...');
  output = execSync('make build-api-docs');
  console.log(output.toString());
};

for (const w of watchers) {
  w.on('change', makeApiDocsCommand);
  w.on('add', makeApiDocsCommand);
  w.on('delete', makeApiDocsCommand);
}
console.log('rebuilding API docs on changes');
