import {defineRule} from '@oxlint/plugins';
import {RuleTester} from 'oxlint/plugins-dev';

import {getStyledCallInfo} from './styled';

/**
 * Minimal rule that reports the kind and name from getStyledCallInfo.
 * Used to test the utility via RuleTester.
 */
const testRule = defineRule({
  meta: {type: 'problem', schema: [], messages: {info: '{{kind}}:{{name}}'}},
  create(context) {
    return {
      TaggedTemplateExpression(node) {
        const info = getStyledCallInfo(node);
        if (info) {
          context.report({
            node,
            messageId: 'info',
            data: {kind: info.kind, name: 'name' in info ? info.name : ''},
          });
        }
      },
      CallExpression(node) {
        const info = getStyledCallInfo(node);
        if (info) {
          context.report({
            node,
            messageId: 'info',
            data: {kind: info.kind, name: 'name' in info ? info.name : ''},
          });
        }
      },
    };
  },
});

const ruleTester = new RuleTester();

ruleTester.run('getStyledCallInfo', testRule, {
  valid: [
    {code: 'const x = foo`color: red`;', filename: '/project/src/file.tsx'},
    {code: 'const x = bar.baz`color: red`;', filename: '/project/src/file.tsx'},
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
    // styled('div')`` — only outermost TaggedTemplateExpression matches
    {
      code: "const Box = styled('div')`color: red`;",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'div'}}],
    },
    // styled(Button)`` — only outermost TaggedTemplateExpression matches
    {
      code: 'const MyButton = styled(Button)`color: red`;',
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'component', name: 'Button'}}],
    },
    // styled(Mod.Button)``
    {
      code: 'const MyButton = styled(Mod.Button)`color: red`;',
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'component', name: 'Mod.Button'}}],
    },
    // styled.div({...}) — object syntax call expression
    {
      code: 'const Box = styled.div({ color: "red" });',
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'div'}}],
    },
    // styled('div')({...}) — only outermost CallExpression matches
    {
      code: "const Box = styled('div')({ color: 'red' });",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'div'}}],
    },
  ],
});
