import {defineRule} from '@oxlint/plugins';
import {RuleTester} from 'oxlint/plugins-dev';

import {createImportTracker} from '../tracker/imports';

import {getStyledCallInfo} from './styled';

/**
 * Minimal rule that reports the kind and name from getStyledCallInfo.
 * Used to test the utility via RuleTester.
 */
const testRule = defineRule({
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      info: '{{kind}}:{{name}}',
    },
  },
  create(context) {
    const importTracker = createImportTracker(context);
    return {
      ...importTracker.visitors,
      TaggedTemplateExpression(node) {
        const info = getStyledCallInfo(node, importTracker);
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
        const info = getStyledCallInfo(node, importTracker);
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
    {
      code: "import styled from '@emotion/styled'; const Box = styled('div').attrs({})`color: red`;",
      filename: '/project/src/file.tsx',
    },
    {
      code: "import styled from '@emotion/styled'; const Box = styled('div').attrs({})({color: 'red'});",
      filename: '/project/src/file.tsx',
    },
    {
      code: "import * as emotion from '@emotion/react'; const css = 'other'; const x = emotion[css]`color: red`;",
      filename: '/project/src/file.tsx',
    },
  ],
  invalid: [
    {
      code: "import * as emotion from '@emotion/react'; const x = emotion.css`color: red`;",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'css', name: ''}}],
    },
    // css``
    {
      code: "import {css} from '@emotion/react'; const x = css`color: red`;",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'css', name: ''}}],
    },
    // styled.div``
    {
      code: "import styled from '@emotion/styled'; const Box = styled.div`color: red`;",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'div'}}],
    },
    // styled.span``
    {
      code: "import styled from '@emotion/styled'; const Box = styled.span`color: red`;",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'span'}}],
    },
    // styled('div')`` — only outermost TaggedTemplateExpression matches
    {
      code: "import styled from '@emotion/styled'; const Box = styled('div')`color: red`;",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'div'}}],
    },
    // styled(Button)`` — only outermost TaggedTemplateExpression matches
    {
      code: "import styled from '@emotion/styled'; const MyButton = styled(Button)`color: red`;",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'component', name: 'Button'}}],
    },
    // styled(Mod.Button)``
    {
      code: "import styled from '@emotion/styled'; const MyButton = styled(Mod.Button)`color: red`;",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'component', name: 'Mod.Button'}}],
    },
    // styled.div({...}) — object syntax call expression
    {
      code: "import styled from '@emotion/styled'; const Box = styled.div({ color: 'red' });",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'div'}}],
    },
    // styled('div')({...}) — only outermost CallExpression matches
    {
      code: "import styled from '@emotion/styled'; const Box = styled('div')({ color: 'red' });",
      filename: '/project/src/file.tsx',
      errors: [{messageId: 'info', data: {kind: 'element', name: 'div'}}],
    },
  ],
});
