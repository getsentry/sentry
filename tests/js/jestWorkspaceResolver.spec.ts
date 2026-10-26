import path from 'node:path';

import resolveWorkspace from './jestWorkspaceResolver.cjs';

const root = path.resolve(__dirname, '../..');

describe('Test workspace dependency resolution', () => {
  it.each([
    ['static/app/components', 'sentry-test/reactTestingLibrary', ''],
    ['static/gsApp/views', 'getsentry-test/fixtures/subscription', ''],
    ['static/gsAdmin/components', 'sentry-fixture/organization', ''],
    ['tests/js/sentry-test', '@testing-library/react', 'tests/js'],
    ['tests/js/getsentry-test/fixtures', 'lodash', 'tests/js/getsentry-test'],
    ['static/app/components', 'lodash', 'static/app'],
  ])(
    'resolves %s requesting %s through %s dependencies',
    (directory, request, dependencyOwner) => {
      const defaultResolver = jest.fn(() => '/resolved-module');

      resolveWorkspace(request, {
        basedir: path.join(root, directory),
        defaultResolver,
        defaultAsyncResolver: jest.fn(() => Promise.resolve('/resolved-module')),
        rootDir: root,
      });

      expect(defaultResolver).toHaveBeenCalledWith(
        request,
        expect.objectContaining({
          moduleDirectory: [path.join(root, dependencyOwner, 'node_modules')],
          paths: [],
        })
      );
    }
  );
});
