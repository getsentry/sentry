import {RuleTester} from '@typescript-eslint/rule-tester';

import {noRawCssInStyled} from './noRawCssInStyled';

const ruleTester = new RuleTester();

ruleTester.run('no-raw-css-in-styled', noRawCssInStyled, {
  valid: [
    {
      code: `
        const Foo = styled('div')\`
          \${p => p.active && css\`
            color: red;
          \`}
        \`;
      `,
    },
    {
      code: `
        const Foo = styled('div')\`
          \${p => p.active
            ? css\`color: red;\`
            : css\`color: blue;\`
          }
        \`;
      `,
    },
    {
      code: `
        const Foo = styled('div')\`
          grid-template-areas: \${p => p.vertical
            ? \`'a b' 'c d'\`
            : \`'a c' 'b d'\`
          };
        \`;
      `,
    },
    {
      code: `
        const x = \`border-radius: 4px;\`;
      `,
    },
  ],
  invalid: [
    {
      code: `
        const Foo = styled('div')\`
          \${p => p.active && \`
            color: red;
            border-radius: 4px;
          \`}
        \`;
      `,
      output: `
        const Foo = styled('div')\`
          \${p => p.active && css\`
            color: red;
            border-radius: 4px;
          \`}
        \`;
      `,
      errors: [{messageId: 'useCssTag'}],
    },
    {
      code: `
        const Foo = styled('div')\`
          \${p => p.vertical
            ? \`
              border-bottom-left-radius: 0;
              border-bottom-right-radius: 0;
            \`
            : \`
              border-top-left-radius: 0;
              border-top-right-radius: 0;
            \`
          }
        \`;
      `,
      output: `
        const Foo = styled('div')\`
          \${p => p.vertical
            ? css\`
              border-bottom-left-radius: 0;
              border-bottom-right-radius: 0;
            \`
            : css\`
              border-top-left-radius: 0;
              border-top-right-radius: 0;
            \`
          }
        \`;
      `,
      errors: [{messageId: 'useCssTag'}, {messageId: 'useCssTag'}],
    },
    {
      code: `
        const Foo = styled(Button)\`
          \${p => p.active && \`
            padding: 8px;
          \`}
        \`;
      `,
      output: `
        const Foo = styled(Button)\`
          \${p => p.active && css\`
            padding: 8px;
          \`}
        \`;
      `,
      errors: [{messageId: 'useCssTag'}],
    },
    {
      code: `
        const Foo = styled(({active, ...props}: any) => null)\`
          \${p => p.active && \`
            padding: 8px;
          \`}
        \`;
      `,
      output: `
        const Foo = styled(({active, ...props}: any) => null)\`
          \${p => p.active && css\`
            padding: 8px;
          \`}
        \`;
      `,
      errors: [{messageId: 'useCssTag'}],
    },
  ],
});
