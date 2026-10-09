import path from 'node:path';

import resolveRouter from './jestReactRouterResolver.cjs';

const root = path.resolve(__dirname, '../..');
const compatibilityDirectory = path.join(root, 'static/app/utils/reactRouterV6');

describe('React Router import resolution', () => {
  it.each([
    ['static/app/components', 'react-router', `${compatibilityDirectory}/index.ts`],
    ['static/gsAdmin', 'react-router/dom', `${compatibilityDirectory}/dom.ts`],
    ['tests/js/sentry-test', 'react-router', `${compatibilityDirectory}/index.ts`],
    ['tests/js', 'react-router', `${compatibilityDirectory}/index.ts`],
    ['static/app/utils/reactRouterV6', 'react-router', 'react-router'],
    ['node_modules/react-router-dom', 'react-router', 'react-router'],
    ['static/packages/scraps/node_modules/nuqs', 'react-router', 'react-router'],
    ['static/app', 'nuqs/adapters/react-router/v6', 'nuqs/adapters/react-router/v6'],
  ])('resolves %s requesting %s to %s', (directory, request, expected) => {
    const defaultResolver = jest.fn(() => '/resolved-module');
    const options: Parameters<typeof resolveRouter>[1] = {
      basedir: path.join(root, directory),
      defaultResolver,
      defaultAsyncResolver: jest.fn(() => Promise.resolve('/resolved-module')),
      rootDir: root,
    };

    expect(resolveRouter(request, options)).toBe('/resolved-module');
    expect(defaultResolver).toHaveBeenCalledWith(
      expected,
      expect.objectContaining(options)
    );
  });
});
