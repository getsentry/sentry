import {RuleTester} from 'eslint';

import {useSemanticToken} from './use-semantic-token.mjs';

const ruleTester = new RuleTester();

const validTextColorProperties = [
  'color',
  'text-decoration-color',
  'caret-color',
  '-webkit-text-fill-color',
  '-webkit-text-stroke-color',
  'column-rule-color',
];

const validInteractiveContentTokenPaths = [
  'interactive.chonky.debossed.neutral.content.primary',
  'interactive.chonky.embossed.accent.content',
  'interactive.link.neutral.rest',
  'interactive.link.accent.hover',
];

const invalidPropertyTokenPairs = [
  {property: 'background', tokenPath: 'content.primary'},
  {property: 'border-color', tokenPath: 'content.accent'},
  {property: 'fill', tokenPath: 'content.danger'},
  {property: 'background-color', tokenPath: 'content.secondary'},
  {property: 'stroke', tokenPath: 'content.warning'},
  {property: 'outline-color', tokenPath: 'content.success'},
];

const invalidInteractiveTokenPairs = [
  {
    property: 'background',
    tokenPath: 'interactive.chonky.debossed.neutral.content.primary',
  },
  {property: 'border-color', tokenPath: 'interactive.chonky.embossed.accent.content'},
  {property: 'fill', tokenPath: 'interactive.link.neutral.rest'},
];

/**
 * @param {string} property - CSS property name
 * @param {string} tokenPath - Token path (e.g., 'content.primary')
 * @returns {{code: string}}
 */
const makeValidCase = (property, tokenPath) => ({
  code: `const Component = styled('div')\`
  ${property}: \${p => p.theme.tokens.${tokenPath}};
\`;`,
});

/**
 * @param {string} property - CSS property name
 * @param {string} tokenPath - Token path (e.g., 'content.primary')
 * @returns {{code: string, errors: Array<{messageId: string, data: {tokenPath: string, property: string}}>}}
 */
const makeInvalidCase = (property, tokenPath) => ({
  code: `const Component = styled('div')\`
  ${property}: \${p => p.theme.tokens.${tokenPath}};
\`;`,
  errors: [{messageId: 'invalidProperty', data: {tokenPath, property}}],
});

ruleTester.run('use-semantic-token', useSemanticToken, {
  valid: [
    ...validTextColorProperties.map(prop => makeValidCase(prop, 'content.primary')),
    ...validInteractiveContentTokenPaths.map(tokenPath =>
      makeValidCase('color', tokenPath)
    ),
    {
      code: `const Component = styled('div')\`
  color: \${p => p.theme.tokens.content.primary};
  text-decoration-color: \${p => p.theme.tokens.content.secondary};
  caret-color: \${p => p.theme.tokens.content.accent};
\`;`,
    },
    {
      code: `const Component = styled('div')\`
  color: \${theme.tokens.content.primary};
\`;`,
    },
    {
      code: `const Component = styled('div')\`
  background: \${p => p.theme.tokens.background.primary};
\`;`,
    },
    {
      code: `const Component = styled('div')\`
  border-color: \${p => p.theme.tokens.border.primary};
\`;`,
    },
    {
      code: `const Component = styled(Button)\`
  color: \${p => p.theme.tokens.content.danger};
\`;`,
    },
    {
      code: `const styles = css\`
  color: \${p => p.theme.tokens.content.warning};
\`;`,
    },
    {
      code: `const Component = styled('div')\`
  background: red;
  color: blue;
\`;`,
    },
    {
      code: `const Component = styled('div')\`
  a:hover {
    color: \${p => p.theme.tokens.content.primary};
  }
\`;`,
    },
    {
      code: `const Component = styled.p\`
  color: \${p =>
    ({
      none: p.theme.tokens.content.secondary,
      alert: p.theme.colors.yellow500,
    })[p.status]};
\`;`,
    },
    {
      code: `const Component = styled('div')\`
  &:hover {
    color: \${p => p.theme.tokens.content.accent};
  }
  &:focus {
    color: \${p => p.theme.tokens.content.primary};
  }
\`;`,
    },
    {
      code: `const Component = styled('div')\`
  &::before {
    color: \${p => p.theme.tokens.content.secondary};
  }
\`;`,
    },
    {
      code: `const Component = styled('div')\`
  @media (max-width: 768px) {
    color: \${p => p.theme.tokens.content.primary};
  }
\`;`,
    },
  ],

  invalid: [
    ...invalidPropertyTokenPairs.map(({property, tokenPath}) =>
      makeInvalidCase(property, tokenPath)
    ),
    ...invalidInteractiveTokenPairs.map(({property, tokenPath}) =>
      makeInvalidCase(property, tokenPath)
    ),
    {
      code: `const Component = styled('div')\`
  background: \${p => p.theme.tokens.content.primary};
  border-color: \${p => p.theme.tokens.content.accent};
  fill: \${p => p.theme.tokens.content.danger};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenPath: 'content.primary', property: 'background'},
        },
        {
          messageId: 'invalidProperty',
          data: {tokenPath: 'content.accent', property: 'border-color'},
        },
        {
          messageId: 'invalidProperty',
          data: {tokenPath: 'content.danger', property: 'fill'},
        },
      ],
    },
    {
      code: `const Component = styled(Button)\`
  background: \${p => p.theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenPath: 'content.primary', property: 'background'},
        },
      ],
    },
    {
      code: `const styles = css\`
  background: \${p => p.theme.tokens.content.accent};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenPath: 'content.accent', property: 'background'},
        },
      ],
    },
    {
      code: `const Component = styled('div')\`
  background: \${theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenPath: 'content.primary', property: 'background'},
        },
      ],
    },
    {
      code: `const Component = styled('div')\`
  box-shadow: 0 0 5px \${p => p.theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenPath: 'content.primary', property: 'box-shadow'},
        },
      ],
    },
    // Multiple tokens in a single expression (ternary)
    {
      code: `const Component = styled('div')\`
  background: \${p => foo ? p.theme.tokens.content.primary : p.theme.tokens.content.accent};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenPath: 'content.primary', property: 'background'},
        },
        {
          messageId: 'invalidProperty',
          data: {tokenPath: 'content.accent', property: 'background'},
        },
      ],
    },
  ],
});
