import {RuleTester} from 'oxlint/plugins-dev';

import {noLegacyRouterImports} from './noLegacyRouterImports';

const ruleTester = new RuleTester();

ruleTester.run('no-legacy-router-imports', noLegacyRouterImports, {
  valid: [
    "import {Link, type Location} from 'react-router';",
    "import {RouterProvider} from 'react-router/dom';",
    "import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';",
    "import {wrapCreateBrowserRouterV6} from '@sentry/react';",
    "export {useLocation} from 'react-router';",
    "type Location = import('react-router').Location;",
    "jest.mock('react-router');",
    "jest.requireActual('react-router/dom');",
    "import 'react-router-dom-extra';",
    "import '@remix-run/router-extra';",
    "const documentation = 'react-router-dom';",
    "other.mock('react-router-dom');",
    'import(moduleName);',
    'require(moduleName);',
    'jest.mock(moduleName);',
    'import(`react-router-${version}`);',
  ].map(code => ({code, filename: '/project/test.tsx'})),
  invalid: [
    ...[
      'react-router-dom',
      'react-router-dom/server',
      '@remix-run/router',
      '@remix-run/router/dist/router',
      'react-router/dist/index.js',
    ].map(source => ({
      code: `import * as router from '${source}';`,
      errors: [{messageId: 'legacyPath' as const, data: {path: source}}],
    })),
    ...[
      "import 'react-router-dom';",
      "import type {Location} from 'react-router-dom';",
      "export {Link} from 'react-router-dom';",
      "export type {Location} from 'react-router-dom';",
      "export * from 'react-router-dom';",
      "export * as router from 'react-router-dom';",
      "export type * from 'react-router-dom';",
      "import('react-router-dom');",
      'import(`react-router-dom`);',
      "type Location = import('react-router-dom').Location;",
      "type Router = typeof import('react-router-dom');",
      "import router = require('react-router-dom');",
      "require('react-router-dom');",
      "require.resolve('react-router-dom');",
      'require(`react-router-dom`);',
      "jest['mock']('react-router-dom');",
    ].map(code => ({
      code,
      errors: [{messageId: 'legacyPath' as const}],
    })),
    ...[
      'mock',
      'doMock',
      'unmock',
      'deepUnmock',
      'requireActual',
      'requireMock',
      'setMock',
      'unstable_mockModule',
      'unstable_unmockModule',
    ].map(method => ({
      code: `jest.${method}('react-router-dom');`,
      errors: [{messageId: 'legacyPath' as const}],
    })),
  ].map(test => ({...test, filename: '/project/test.tsx'})),
});
