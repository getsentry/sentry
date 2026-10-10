const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const compatibilityDirectory = path.join(root, 'static/app/utils/reactRouterV6');
const sourceDirectories = [path.join(root, 'static'), path.join(root, 'tests/js')];
const workspaceDirectories = ['app', 'gsApp', 'gsAdmin'].map(directory =>
  path.join(root, 'static', directory)
);

/** @type {import('jest-resolve').SyncResolver} */
module.exports = function resolveReactRouter(request, options) {
  const workspaceDirectory = workspaceDirectories.find(
    directory =>
      options.basedir === directory ||
      options.basedir.startsWith(`${directory}${path.sep}`)
  );
  if (workspaceDirectory && !options.basedir.split(path.sep).includes('node_modules')) {
    options = {
      ...options,
      moduleDirectory: [path.join(workspaceDirectory, 'node_modules')],
      paths: [],
    };
  }

  // Dependencies and the compatibility implementation must resolve V6's own
  // react-router imports normally, so every consumer shares the same contexts.
  const isSource = sourceDirectories.some(
    directory =>
      options.basedir === directory ||
      options.basedir.startsWith(`${directory}${path.sep}`)
  );
  if (
    isSource &&
    !options.basedir.split(path.sep).includes('node_modules') &&
    options.basedir !== compatibilityDirectory &&
    !options.basedir.startsWith(`${compatibilityDirectory}${path.sep}`)
  ) {
    if (request === 'react-router') {
      request = path.join(compatibilityDirectory, 'index.ts');
    } else if (request === 'react-router/dom') {
      request = path.join(compatibilityDirectory, 'dom.ts');
    }
  }

  return options.defaultResolver(request, options);
};
