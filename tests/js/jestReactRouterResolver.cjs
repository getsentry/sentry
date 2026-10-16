const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const compatibilityDirectory = path.join(root, 'static/app/utils/reactRouterV6');
const sourceDirectories = [path.join(root, 'static'), path.join(root, 'tests/js')];
const appDirectories = ['app', 'gsApp', 'gsAdmin'].map(directory =>
  path.join(root, 'static', directory)
);
const workspaceDirectories = [
  path.join(root, 'tests/js/getsentry-test'),
  path.join(root, 'tests/js'),
  ...appDirectories,
];

const v8Aliases = new Map([
  ['react-router', 'react-router-v8'],
  ['react-router/dom', 'react-router-v8/dom'],
  ['react-router-dom', 'react-router-v8'],
  ['nuqs/adapters/react-router/v6', 'nuqs/adapters/react-router/v8'],
]);

/** @type {import('jest-resolve').SyncResolver} */
module.exports = function resolveReactRouter(request, options) {
  if (process.env.SENTRY_REACT_ROUTER_VERSION === '8') {
    const alias = v8Aliases.get(request);
    if (alias) {
      return options.defaultResolver(alias, {...options, basedir: root});
    }
  }
  const workspaceDirectory = workspaceDirectories.find(
    directory =>
      options.basedir === directory ||
      options.basedir.startsWith(`${directory}${path.sep}`)
  );
  if (workspaceDirectory && !options.basedir.split(path.sep).includes('node_modules')) {
    // The root owns application testing. App specs use its test packages without
    // adding a reverse dependency from an app to its app-aware test support.
    const isRootTestImport =
      appDirectories.includes(workspaceDirectory) &&
      /^(sentry-test|sentry-fixture|getsentry-test)(\/|$)/.test(request);
    options = {
      ...options,
      moduleDirectory: [
        path.join(isRootTestImport ? root : workspaceDirectory, 'node_modules'),
      ],
      paths: [],
    };
  }

  // V6 dependencies must resolve their own core package to share router contexts.
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
