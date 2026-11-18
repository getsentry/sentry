import {defineRule, type ESTree} from '@oxlint/plugins';
import {RuleTester} from 'oxlint/plugins-dev';

import {createImportTracker} from './imports';

/**
 * Minimal rule that resolves a specific identifier via the import tracker
 * and reports the result.
 */
const testRule = defineRule({
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
    const tracker = createImportTracker(context);

    return {
      // Test resolve() by checking JSX element names
      JSXOpeningElement(node: ESTree.JSXOpeningElement) {
        if (node.name.type === 'JSXIdentifier') {
          const info = tracker.resolve(node.name);
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
      code: `
        import {Flex as F, Flex} from '@sentry/scraps/layout';
        import type {Flex as T} from '@sentry/scraps/layout';
        import {type Flex as U} from '@sentry/scraps/layout';
        import {Flex as O} from '@sentry/scraps/other';
      `,
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'found', data: {localNames: 'F,Flex'}}],
    },
    {
      code: `
        const x = <Button />;
        import {Button} from '@sentry/scraps/button';
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
      code: `
        import {Button} from '@sentry/scraps/button';
        function f(Button) {
          return <Button />;
        }
      `,
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'unresolved', data: {name: 'Button'}}],
    },
    {
      code: `
        import {'Button' as B} from '@sentry/scraps/button';
        const x = <B />;
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
      code: `
        import {type Button} from '@sentry/scraps/button';
        const x = <Button />;
      `,
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'unresolved', data: {name: 'Button'}}],
    },
  ],
});

const isRule = defineRule({
  meta: {
    type: 'problem',
    schema: [],
    messages: {matched: 'matched'},
  },
  create(context) {
    const tracker = createImportTracker(context);
    return {
      JSXOpeningElement(node) {
        if (tracker.is(node.name, '@sentry/scraps/button', 'Button')) {
          context.report({node, messageId: 'matched'});
        }
      },
      CallExpression(node) {
        if (tracker.is(node.callee, '@sentry/scraps/button', 'Button')) {
          context.report({node, messageId: 'matched'});
        }
      },
    };
  },
});

ruleTester.run('createImportTracker is', isRule, {
  valid: [
    "import {Other} from '@sentry/scraps/button'; const x = <Other />;",
    "import * as mod from '@sentry/scraps/button'; const x = <mod.Other />;",
    "import {mod} from '@sentry/scraps/button'; const x = <mod.Button />;",
    "import * as mod from '@sentry/scraps/other'; const x = <mod.Button />;",
    "import * as mod from '@sentry/scraps/button'; mod.Other();",
    "import * as mod from '@sentry/scraps/button'; mod['Button']();",
    "import {mod} from '@sentry/scraps/button'; mod.Button();",
    "import * as mod from '@sentry/scraps/other'; mod.Button();",
  ],
  invalid: [
    {
      code: "import {Button} from '@sentry/scraps/button'; const x = <Button />;",
      errors: [{messageId: 'matched'}],
    },
    {
      code: "import * as mod from '@sentry/scraps/button'; const x = <mod.Button />;",
      errors: [{messageId: 'matched'}],
    },
    {
      code: "import * as mod from '@sentry/scraps/button'; mod.Button();",
      errors: [{messageId: 'matched'}],
    },
  ],
});
