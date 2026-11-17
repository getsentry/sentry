const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const appDirectories = ['app', 'gsApp', 'gsAdmin'].map(directory =>
  path.join(root, 'static', directory)
);
const workspaceDirectories = [
  path.join(root, 'tests/js/getsentry-test'),
  path.join(root, 'tests/js'),
  ...appDirectories,
];

/** @type {import('jest-resolve').SyncResolver} */
module.exports = function resolveWorkspace(request, options) {
  const workspaceDirectory = workspaceDirectories.find(
    directory =>
      options.basedir === directory ||
      options.basedir.startsWith(`${directory}${path.sep}`)
  );
  if (workspaceDirectory && !options.basedir.split(path.sep).includes('node_modules')) {
    const isAppTestSupportImport =
      appDirectories.includes(workspaceDirectory) &&
      /^(sentry-test|sentry-fixture|getsentry-test)(\/|$)/.test(request);
    options = {
      ...options,
      moduleDirectory: [
        path.join(isAppTestSupportImport ? root : workspaceDirectory, 'node_modules'),
      ],
      paths: [],
    };
  }

  return options.defaultResolver(request, options);
};
