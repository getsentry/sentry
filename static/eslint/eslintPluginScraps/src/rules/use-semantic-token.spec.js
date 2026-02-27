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
  {suggestedCategory: 'syntax', property: 'background', tokenPath: 'content.primary'},
  {suggestedCategory: 'border', property: 'border-color', tokenPath: 'content.accent'},
  {
    suggestedCategory: 'syntax',
    property: 'background-color',
    tokenPath: 'content.secondary',
  },
  {suggestedCategory: 'graphics', property: 'stroke', tokenPath: 'content.warning'},
  {suggestedCategory: 'focus', property: 'outline-color', tokenPath: 'content.success'},
];

const invalidInteractiveTokenPairs = [
  {
    suggestedCategory: 'syntax',
    property: 'background',
    tokenPath: 'interactive.chonky.debossed.neutral.content.primary',
  },
  {
    suggestedCategory: 'border',
    property: 'border-color',
    tokenPath: 'interactive.chonky.embossed.accent.content',
  },
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
 * @param {string} suggestedCategory - Data entry to suggest switching to
 * @param {string} property - CSS property name
 * @param {string} tokenPath - Token path (e.g., 'content.primary')
 * @returns {{code: string, errors: Array<{messageId: string, data: {suggestedCategory: string, tokenPath: string, property: string}}>}}
 */
const makeInvalidCase = (suggestedCategory, property, tokenPath) => ({
  code: `const Component = styled('div')\`
  ${property}: \${p => p.theme.tokens.${tokenPath}};
\`;`,
  errors: [
    {
      messageId: 'invalidPropertyWithSuggestion',
      data: {suggestedCategory, tokenPath, property},
    },
  ],
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
    ...invalidPropertyTokenPairs.map(({suggestedCategory, property, tokenPath}) =>
      makeInvalidCase(suggestedCategory, property, tokenPath)
    ),
    ...invalidInteractiveTokenPairs.map(({suggestedCategory, property, tokenPath}) =>
      makeInvalidCase(suggestedCategory, property, tokenPath)
    ),
    {
      code: `const Component = styled('div')\`
  background: \${p => p.theme.tokens.content.primary};
  border-color: \${p => p.theme.tokens.content.accent};
\`;`,
      errors: [
        {
          messageId: 'invalidPropertyWithSuggestion',
          data: {
            tokenPath: 'content.primary',
            property: 'background',
            suggestedCategory: 'syntax',
          },
        },
        {
          messageId: 'invalidPropertyWithSuggestion',
          data: {
            tokenPath: 'content.accent',
            property: 'border-color',
            suggestedCategory: 'border',
          },
        },
      ],
    },
    {
      code: `const Component = styled(Button)\`
  background: \${p => p.theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidPropertyWithSuggestion',
          data: {
            tokenPath: 'content.primary',
            property: 'background',
            suggestedCategory: 'syntax',
          },
        },
      ],
    },
    {
      code: `const styles = css\`
  background: \${p => p.theme.tokens.content.accent};
\`;`,
      errors: [
        {
          messageId: 'invalidPropertyWithSuggestion',
          data: {
            tokenPath: 'content.accent',
            property: 'background',
            suggestedCategory: 'syntax',
          },
        },
      ],
    },
    {
      code: `const Component = styled('div')\`
  background: \${theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidPropertyWithSuggestion',
          data: {
            tokenPath: 'content.primary',
            property: 'background',
            suggestedCategory: 'syntax',
          },
        },
      ],
    },
    {
      code: `const Component = styled('div')\`
  box-shadow: 0 0 5px \${p => p.theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidPropertyWithSuggestion',
          data: {
            tokenPath: 'content.primary',
            property: 'box-shadow',
            suggestedCategory: 'focus',
          },
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
          messageId: 'invalidPropertyWithSuggestion',
          data: {
            property: 'background',
            suggestedCategory: 'syntax',
            tokenPath: 'content.primary',
          },
        },
        {
          messageId: 'invalidPropertyWithSuggestion',
          data: {
            property: 'background',
            suggestedCategory: 'syntax',
            tokenPath: 'content.accent',
          },
        },
      ],
    },
  ],
});
