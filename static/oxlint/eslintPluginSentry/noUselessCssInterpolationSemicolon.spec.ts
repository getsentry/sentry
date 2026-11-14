import {RuleTester} from 'oxlint/plugins-dev';

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
          \${p => p.active ? p.color : css\`color: red;\`};
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
      {
        code: "const Foo = styled('div')`${p => p.active && other`color: red;`};`;",
      },
      {
        code: 'const value = this.tag`${css`color: red;`};`;',
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
        errors: [
          {
            messageId: 'noUselessSemicolon',
            line: 3,
            column: 46,
            endLine: 3,
            endColumn: 47,
          },
        ],
      },
      {
        code: 'const Foo = styled.div`${css`color: red;`};`;',
        output: 'const Foo = styled.div`${css`color: red;`}`;',
        errors: [{messageId: 'noUselessSemicolon'}],
      },
      {
        code: 'const styles = css`${p => p.active && css`color: red;`};`;',
        output: 'const styles = css`${p => p.active && css`color: red;`}`;',
        errors: [{messageId: 'noUselessSemicolon'}],
      },
      {
        code: "const Foo = styled('div')`${ p => p.active && css`color: red;` };`;",
        output: "const Foo = styled('div')`${ p => p.active && css`color: red;` }`;",
        errors: [{messageId: 'noUselessSemicolon'}],
      },
      {
        code: "const Foo = styled('div')`${(p => p.active && css`color: red;`)};`;",
        output: "const Foo = styled('div')`${(p => p.active && css`color: red;`)}`;",
        errors: [{messageId: 'noUselessSemicolon'}],
      },
      {
        code: "const Foo = styled('div')`${css`color: red;` /* comment */};`;",
        output: "const Foo = styled('div')`${css`color: red;` /* comment */}`;",
        errors: [{messageId: 'noUselessSemicolon'}],
      },
    ],
  }
);
