import {RuleTester} from '@typescript-eslint/rule-tester';

import {noUselessCssInterpolationSemicolon} from './noUselessCssInterpolationSemicolon';

const ruleTester = new RuleTester();

ruleTester.run(
  'no-useless-css-interpolation-semicolon',
  noUselessCssInterpolationSemicolon,
  {
    valid: [
      {
        code: `
        const Foo = styled('div')\`
          \${p =>
            p.active &&
            css\`
              color: red;
            \`}
        \`;
      `,
      },
      {
        code: `
        const Foo = styled('div')\`
          width: \${p => \`\${p.width}px\`};
        \`;
      `,
      },
      {
        code: `
        const Foo = styled('div')\`
          \${p => p.active && \`color: red;\`};
        \`;
      `,
      },
      {
        code: `
        const Foo = styled('div')\`
          \${p =>
            p.active
              ? css\`
                  color: red;
                \`
              : \`color: \${p.color}\`};
        \`;
      `,
      },
      {
        code: `
        const Foo = styled('div')\`
          \${p => p.active ? css\`color: red;\` : p.color};
        \`;
      `,
      },
      {
        code: `
        const Foo = styled('div')\`
          \${p => p.color || css\`color: red;\`};
        \`;
      `,
      },
      {
        code: `
        const styles = css\`
          color: red;
        \`;
      `,
      },
    ],
    invalid: [
      {
        code: `
        const Foo = styled('div')\`
          \${p =>
            p.active &&
            css\`
              color: red;
            \`};
        \`;
      `,
        output: `
        const Foo = styled('div')\`
          \${p =>
            p.active &&
            css\`
              color: red;
            \`}
        \`;
      `,
        errors: [{messageId: 'noUselessSemicolon'}],
      },
      {
        code: `
        const Foo = styled('div')\`
          \${p =>
            p.active
              ? css\`
                  color: red;
                \`
              : css\`
                  color: blue;
                \`};
        \`;
      `,
        output: `
        const Foo = styled('div')\`
          \${p =>
            p.active
              ? css\`
                  color: red;
                \`
              : css\`
                  color: blue;
                \`}
        \`;
      `,
        errors: [{messageId: 'noUselessSemicolon'}],
      },
      {
        code: `
        const Foo = styled('div')\`
          \${p => p.active && css\`color: red;\`};
        \`;
      `,
        output: `
        const Foo = styled('div')\`
          \${p => p.active && css\`color: red;\`}
        \`;
      `,
        errors: [{messageId: 'noUselessSemicolon'}],
      },
    ],
  }
);
