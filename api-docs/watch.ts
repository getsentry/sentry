/* eslint-env node */
/* eslint import/no-nodejs-modules:0 no-console:0 */
import {spawn} from 'child_process';

import sane from 'sane';

const watcherPy = sane('src/sentry');
const watcherJson = sane('api-docs');

const watchers = [watcherPy, watcherJson];

let isCurrentlyRunning = false;

const makeApiDocsCommand = function () {
  if (isCurrentlyRunning) {
    console.log('already rebuilding docs');
    return;
  }
  console.log('rebuilding OpenAPI schema...');
  isCurrentlyRunning = true;
  const buildCommand = spawn('make', ['build-api-docs']);

  buildCommand.stdout.on('data', function (data) {
    process.stdout.write(data.toString());
  });

  buildCommand.stderr.on('data', function (data) {
    process.stderr.write('stderr: ' + data.toString());
  });

  buildCommand.on('exit', function () {
    isCurrentlyRunning = false;
  });
};

for (const w of watchers) {
  w.on('change', makeApiDocsCommand);
  w.on('add', makeApiDocsCommand);
  w.on('delete', makeApiDocsCommand);
}
console.log('rebuilding OpenAPI schema on changes');
