import {RuleTester} from '@typescript-eslint/rule-tester';
import {ESLintUtils, TSESTree} from '@typescript-eslint/utils';

import {createImportTracker} from './imports';

/**
 * Minimal rule that resolves a specific identifier via the import tracker
 * and reports the result.
 */
const testRule = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      resolved: '{{source}}:{{imported}}',
      unresolved: 'unresolved:{{name}}',
      found: 'found:{{localNames}}',
    },
  },
  create(context) {
    const tracker = createImportTracker();

    return {
      ...tracker.visitors,

      // Test resolve() by checking JSX element names
      JSXOpeningElement(node: TSESTree.JSXOpeningElement) {
        if (node.name.type === 'JSXIdentifier') {
          const info = tracker.resolve(node.name.name);
          if (info) {
            context.report({
              node,
              messageId: 'resolved',
              data: {source: info.source, imported: info.imported},
            });
          } else {
            context.report({
              node,
              messageId: 'unresolved',
              data: {name: node.name.name},
            });
          }
        }
      },

      // Test findLocalNames() via a special comment trigger
      'Program:exit'() {
        const localNames = tracker.findLocalNames('@sentry/scraps/layout', 'Flex');
        if (localNames.length > 0) {
          context.report({
            node: context.sourceCode.ast,
            messageId: 'found',
            data: {localNames: localNames.join(',')},
          });
        }
      },
    };
  },
});

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

ruleTester.run('createImportTracker', testRule, {
  valid: [],
  invalid: [
    {
      // Named import resolves correctly
      code: `
        import {Button} from '@sentry/scraps/button';
        const x = <Button />;
      `,
      filename: '/project/src/file.tsx',
      errors: [
        {
          messageId: 'resolved',
          data: {source: '@sentry/scraps/button', imported: 'Button'},
        },
      ],
    },
    {
      // Aliased import resolves correctly
      code: `
        import {Button as Btn} from '@sentry/scraps/button';
        const x = <Btn />;
      `,
      filename: '/project/src/file.tsx',
      errors: [
        {
          messageId: 'resolved',
          data: {source: '@sentry/scraps/button', imported: 'Button'},
        },
      ],
    },
    {
      // Unknown component is unresolved
      code: `
        const x = <Unknown />;
      `,
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'unresolved', data: {name: 'Unknown'}}],
    },
    {
      // findLocalNames works — Program:exit fires after JSXOpeningElement
      code: `
        import {Flex} from '@sentry/scraps/layout';
        const x = <Flex />;
      `,
      filename: '/project/src/file.tsx',
      errors: [
        {messageId: 'found'},
        {
          messageId: 'resolved',
          data: {source: '@sentry/scraps/layout', imported: 'Flex'},
        },
      ],
    },
    {
      // findLocalNames with alias
      code: `
        import {Flex as F} from '@sentry/scraps/layout';
        const x = <F />;
      `,
      filename: '/project/src/file.tsx',
      errors: [
        {messageId: 'found'},
        {
          messageId: 'resolved',
          data: {source: '@sentry/scraps/layout', imported: 'Flex'},
        },
      ],
    },
  ],
});
