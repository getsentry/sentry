import {RuleTester} from '@typescript-eslint/rule-tester';
import {ESLintUtils} from '@typescript-eslint/utils';

import {getStyledCallInfo} from './styled';

/**
 * Minimal rule that reports the kind and name from getStyledCallInfo.
 * Used to test the utility via RuleTester.
 */
const testRule = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      info: '{{kind}}:{{name}}',
    },
  },
  create(context) {
    return {
      TaggedTemplateExpression(node) {
        const info = getStyledCallInfo(node);
        if (info) {
          context.report({
            node,
            messageId: 'info',
            data: {
              kind: info.kind,
              name: 'name' in info ? info.name : '',
            },
          });
        }
      },
      CallExpression(node) {
        const info = getStyledCallInfo(node);
        if (info) {
          context.report({
            node,
            messageId: 'info',
            data: {
              kind: info.kind,
              name: 'name' in info ? info.name : '',
            },
          });
        }
      },
    };
  },
});

const ruleTester = new RuleTester();

ruleTester.run('getStyledCallInfo', testRule, {
  valid: [
    {
      code: 'const x = foo`color: red`;',
      filename: '/project/src/file.tsx',
    },
    {
      code: 'const x = bar.baz`color: red`;',
      filename: '/project/src/file.tsx',
    },
  ],
  invalid: [
    // css``
    {
      code: 'const x = css`color: red`;',
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'css', name: ''}}],
    },
    // styled.div``
    {
      code: 'const Box = styled.div`color: red`;',
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'div'}}],
    },
    // styled.span``
    {
      code: 'const Box = styled.span`color: red`;',
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'span'}}],
    },
    // styled('div')`` — both TaggedTemplateExpression and inner CallExpression match
    {
      code: "const Box = styled('div')`color: red`;",
      filename: '/project/src/file.tsx',
      errors: [
        {messageId: 'info', data: {kind: 'element', name: 'div'}},
        {messageId: 'info', data: {kind: 'element', name: 'div'}},
      ],
    },
    // styled(Button)`` — both TaggedTemplateExpression and inner CallExpression match
    {
      code: 'const MyButton = styled(Button)`color: red`;',
      filename: '/project/src/file.tsx',
      errors: [
        {messageId: 'info', data: {kind: 'component', name: 'Button'}},
        {messageId: 'info', data: {kind: 'component', name: 'Button'}},
      ],
    },
    // styled(Mod.Button)``
    {
      code: 'const MyButton = styled(Mod.Button)`color: red`;',
      filename: '/project/src/file.tsx',
      errors: [
        {messageId: 'info', data: {kind: 'component', name: 'Mod.Button'}},
        {messageId: 'info', data: {kind: 'component', name: 'Mod.Button'}},
      ],
    },
    // styled.div({...}) — object syntax call expression
    {
      code: 'const Box = styled.div({ color: "red" });',
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'div'}}],
    },
    // styled('div')({...})
    {
      code: "const Box = styled('div')({ color: 'red' });",
      filename: '/project/src/file.tsx',
      errors: [
        // The outer call and the inner styled('div') both match
        {messageId: 'info', data: {kind: 'element', name: 'div'}},
        {messageId: 'info', data: {kind: 'element', name: 'div'}},
      ],
    },
  ],
});
