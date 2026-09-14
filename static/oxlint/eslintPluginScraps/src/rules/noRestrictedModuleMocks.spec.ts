import {RuleTester} from '@typescript-eslint/rule-tester';

import {noRestrictedModuleMocks} from './noRestrictedModuleMocks';

const ruleTester = new RuleTester();

ruleTester.run('no-restricted-module-mocks', noRestrictedModuleMocks, {
  valid: [
    "jest.mock('sentry/utils/analytics');",
    "jest.mock('sentry/utils/useLocationExtra');",
    "jest.requireActual('sentry/utils/useLocation');",
    "other.mock('sentry/utils/useLocation');",
    'jest.mock(moduleName);',
    "const hooks = {useLocation() {}}; jest.spyOn(hooks, 'useLocation');",
    "import * as location from 'sentry/utils/useLocation'; jest.spyOn(location, 'parseLocation');",
  ],
  invalid: [
    ...['useLocation', 'useNavigate', 'useOrganization', 'useProjects'].flatMap(hook =>
      ['mock', 'doMock'].map(method => ({
        code: `jest.${method}('sentry/utils/${hook}', () => ({}));`,
        errors: [{messageId: 'forbidden' as const}],
      }))
    ),
    {
      code: "jest.mock('sentry/utils/useLocation');",
      errors: [
        {
          messageId: 'forbidden',
          data: {
            hook: 'useLocation',
            replacement: 'Set initialRouterConfig.location in the render options.',
          },
        },
      ],
    },
    {
      code: "import * as router from 'sentry/utils/useNavigate'; jest.spyOn(router, 'useNavigate');",
      errors: [
        {
          messageId: 'forbidden',
          data: {
            hook: 'useNavigate',
            replacement:
              'Use the router provided by render and assert on router.location after interacting.',
          },
        },
      ],
    },
    {
      code: "jest.spyOn(require('sentry/utils/useOrganization'), 'useOrganization');",
      errors: [{messageId: 'forbidden'}],
    },
  ],
});
