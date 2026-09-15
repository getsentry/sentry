import {defineRule} from '@oxlint/plugins';

import {createImportTracker} from '../ast/tracker/imports.ts';

const replacements = new Map([
  [
    'sentry/components/pageFilters/usePageFilters',
    'Use PageFiltersStore.onInitializeUrlState(PageFiltersFixture({...})).',
  ],
  [
    'sentry/utils/useOrganization',
    'Pass organization: OrganizationFixture({...}) to the render options.',
  ],
  ['sentry/utils/useProjects', 'Use ProjectsStore.loadInitialData([ProjectFixture()]).'],
  ['sentry/utils/useLocation', 'Set initialRouterConfig.location in the render options.'],
  [
    'sentry/utils/useParams',
    'Set initialRouterConfig.route and initialRouterConfig.location in the render options.',
  ],
  [
    'sentry/utils/useNavigate',
    'Use the router provided by render and assert on router.location after interacting.',
  ],
]);

/**
 * Prevents tests from mocking selected Sentry hooks with `jest.mock`,
 * `jest.doMock`, or `jest.spyOn`, and directs them to the supported render
 * options, stores, or fixtures listed above instead.
 */
export const noRestrictedModuleMocks = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow module mocking of hooks with supported test providers or stores.',
    },
    schema: [],
    messages: {
      forbidden: 'Do not mock {{hook}}. {{replacement}}',
    },
  },
  create(context) {
    if (!context.sourceCode.text.includes('jest')) {
      return {};
    }

    const importTracker = createImportTracker();

    return {
      ...importTracker.visitors,

      CallExpression(node) {
        const {callee} = node;
        if (
          callee.type !== 'MemberExpression' ||
          callee.object.type !== 'Identifier' ||
          callee.object.name !== 'jest' ||
          callee.property.type !== 'Identifier'
        ) {
          return;
        }

        if (callee.property.name === 'mock' || callee.property.name === 'doMock') {
          const source = node.arguments[0];
          if (source?.type !== 'Literal' || typeof source.value !== 'string') {
            return;
          }

          const replacement = replacements.get(source.value);
          if (replacement) {
            context.report({
              node: source,
              messageId: 'forbidden',
              data: {hook: source.value.split('/').at(-1), replacement},
            });
          }
          return;
        }

        if (callee.property.name !== 'spyOn') {
          return;
        }

        const moduleObject = node.arguments[0];
        const property = node.arguments[1];
        if (
          !moduleObject ||
          moduleObject.type === 'SpreadElement' ||
          property?.type !== 'Literal' ||
          typeof property.value !== 'string'
        ) {
          return;
        }

        let moduleSource: string | undefined;
        if (moduleObject.type === 'Identifier') {
          const importedModule = importTracker.resolve(moduleObject.name);
          if (importedModule?.imported === '*') {
            moduleSource = importedModule.source;
          }
        } else if (
          moduleObject.type === 'CallExpression' &&
          moduleObject.callee.type === 'Identifier' &&
          moduleObject.callee.name === 'require'
        ) {
          const source = moduleObject.arguments[0];
          if (source?.type === 'Literal' && typeof source.value === 'string') {
            moduleSource = source.value;
          }
        }

        if (!moduleSource) {
          return;
        }

        const replacement = replacements.get(moduleSource);
        const hook = moduleSource.split('/').at(-1);
        if (!replacement || property.value !== hook) {
          return;
        }

        context.report({
          node: property,
          messageId: 'forbidden',
          data: {hook, replacement},
        });
      },
    };
  },
});
