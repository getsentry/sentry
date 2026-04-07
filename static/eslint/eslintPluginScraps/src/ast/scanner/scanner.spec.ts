import {RuleTester} from '@typescript-eslint/rule-tester';
import {ESLintUtils} from '@typescript-eslint/utils';

import {createQuasiScanner} from './index';

/**
 * Minimal rule that reports each quasi's CSS text via createQuasiScanner.
 */
const testRule = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      quasi: '{{kind}}:{{text}}',
    },
  },
  create(context) {
    return createQuasiScanner(context, (cssText, quasi, info) => {
      context.report({
        node: quasi,
        messageId: 'quasi',
        data: {
          kind: info.kind,
          text: cssText.trim().slice(0, 40),
        },
      });
    });
  },
});

const ruleTester = new RuleTester();

ruleTester.run('createQuasiScanner', testRule, {
  valid: [
    {
      // No emotion usage — shouldAnalyze bails out
      code: 'const x = "hello";',
      filename: '/project/src/file.tsx',
    },
    {
      // Non-styled tagged template — getStyledCallInfo returns null
      code: `
        import styled from '@emotion/styled';
        const x = html\`<div>hi</div>\`;
      `,
      filename: '/project/src/file.tsx',
    },
  ],
  invalid: [
    {
      code: `
        import styled from '@emotion/styled';
        const Box = styled.div\`
          color: red;
        \`;
      `,
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'quasi'}],
    },
    {
      code: `
        import styled from '@emotion/styled';
        const Box = css\`
          background: blue;
        \`;
      `,
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'quasi'}],
    },
    {
      // Multiple quasis from interpolation
      code: `
        import styled from '@emotion/styled';
        const Box = styled.div\`
          color: \${red};
          background: blue;
        \`;
      `,
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'quasi'}, {messageId: 'quasi'}],
    },
  ],
});
