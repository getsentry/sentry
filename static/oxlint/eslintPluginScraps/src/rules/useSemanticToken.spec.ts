import {RuleTester} from 'oxlint/plugins-dev';

import {useSemanticToken} from './useSemanticToken';

const ruleTester = new RuleTester();
const emotion =
  "import styled from '@emotion/styled'; import {css} from '@emotion/react';\n";

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

const makeValidCase = (property: string, tokenPath: string) => ({
  code: `${emotion}const Component = styled('div')\`
  ${property}: \${p => p.theme.tokens.${tokenPath}};
\`;`,
});

const makeInvalidCase = (
  suggestedCategory: string,
  property: string,
  tokenPath: string
): RuleTester.InvalidTestCase => ({
  code: `${emotion}const Component = styled('div')\`
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
    ...['eslint', 'oxlint'].flatMap(prefix => [
      {
        name:
          prefix + ' next-line directive supports multiline values and nested selectors',
        code: `${emotion}const C = styled.div\`
  &:hover {
    /* ${prefix}-disable-next-line rule-to-test/use-semantic-token -- intentional */
    background: \${p =>
      p.theme.tokens.content.primary};
  }
\`;`,
      },
      {
        name: prefix + ' block directive without rule names',
        code: `${emotion}const C = css\`
  /* ${prefix}-disable -- intentional */
  background: \${p => p.theme.tokens.content.primary};
\`;`,
      },
      {
        name: prefix + ' trailing disable-line directive',
        code: `${emotion}const C = styled.div\`
  background: \${p => p.theme.tokens.content.primary}; /* ${prefix}-disable-line rule-to-test/use-semantic-token */
\`;`,
      },
    ]),
    {
      name: 'unrelated styled and css bindings are ignored',
      code: "const styled = x => y => y; const css = x => x; const C = styled('div')`background: ${theme.tokens.content.primary};`; const styles = css`background: ${theme.tokens.content.primary};`;",
    },
    ...validTextColorProperties.map(prop => makeValidCase(prop, 'content.primary')),
    ...validInteractiveContentTokenPaths.map(tokenPath =>
      makeValidCase('color', tokenPath)
    ),
    {
      code: `${emotion}const Component = styled('div')\`
  color: \${p => p.theme.tokens.content.primary};
  text-decoration-color: \${p => p.theme.tokens.content.secondary};
  caret-color: \${p => p.theme.tokens.content.accent};
\`;`,
    },
    {
      code: `${emotion}const Component = styled('div')\`
  color: \${theme.tokens.content.primary};
\`;`,
    },
    {
      code: `${emotion}const Component = styled('div')\`
  background: \${p => p.theme.tokens.background.primary};
\`;`,
    },
    {
      code: `${emotion}const Component = styled('div')\`
  border-color: \${p => p.theme.tokens.border.primary};
\`;`,
    },
    {
      code: `${emotion}const Component = styled(Button)\`
  color: \${p => p.theme.tokens.content.danger};
\`;`,
    },
    {
      code: `${emotion}const styles = css\`
  color: \${p => p.theme.tokens.content.warning};
\`;`,
    },
    {
      code: `${emotion}const Component = styled('div')\`
  background: red;
  color: blue;
\`;`,
    },
    {
      code: `${emotion}const Component = styled('div')\`
  a:hover {
    color: \${p => p.theme.tokens.content.primary};
  }
\`;`,
    },
    {
      code: `${emotion}const Component = styled.p\`
  color: \${p =>
    ({
      none: p.theme.tokens.content.secondary,
      alert: p.theme.colors.yellow500,
    })[p.status]};
\`;`,
    },
    {
      code: `${emotion}const Component = styled('div')\`
  &:hover {
    color: \${p => p.theme.tokens.content.accent};
  }
  &:focus {
    color: \${p => p.theme.tokens.content.primary};
  }
\`;`,
    },
    {
      code: `${emotion}const Component = styled('div')\`
  &::before {
    color: \${p => p.theme.tokens.content.secondary};
  }
\`;`,
    },
    {
      code: `${emotion}const Component = styled('div')\`
  @media (max-width: 768px) {
    color: \${p => p.theme.tokens.content.primary};
  }
\`;`,
    },
  ],

  invalid: [
    ...[
      '/* ordinary comment */',
      '/* eslint-disable-next-line unrelated/rule */',
      'content: "/* eslint-disable-next-line rule-to-test/use-semantic-token */";',
      '/* eslint-disable-next-line rule-to-test/use-semantic-token */\nbackground: ${p => p.theme.tokens.content.primary};',
      '/* eslint-disable rule-to-test/use-semantic-token */\nbackground: ${p => p.theme.tokens.content.primary};\n/* eslint-enable rule-to-test/use-semantic-token */',
      '/* eslint-disable */\nbackground: ${p => p.theme.tokens.content.primary};\n/* eslint-enable rule-to-test/use-semantic-token */',
    ].map(comment => ({
      name: 'only the intended declarations are suppressed: ' + comment,
      code:
        emotion +
        '\nconst C = styled.div`\n' +
        comment +
        '\nbackground: ${p => p.theme.tokens.content.primary};\n`;',
      errors: [{messageId: 'invalidPropertyWithSuggestion'}],
    })),
    {
      name: 'block directives stay within their template',
      code:
        emotion +
        '\nconst A = styled.div`/* eslint-disable */ background: ${p => p.theme.tokens.content.primary};`;\nconst B = styled.div` background: ${p => p.theme.tokens.content.primary};`;',
      errors: [{messageId: 'invalidPropertyWithSuggestion'}],
    },
    ...invalidPropertyTokenPairs.map(({suggestedCategory, property, tokenPath}) =>
      makeInvalidCase(suggestedCategory, property, tokenPath)
    ),
    ...invalidInteractiveTokenPairs.map(({suggestedCategory, property, tokenPath}) =>
      makeInvalidCase(suggestedCategory, property, tokenPath)
    ),
    {
      code: `${emotion}const Component = styled('div')\`
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
      code: `${emotion}const Component = styled(Button)\`
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
      code: `${emotion}const styles = css\`
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
      code: `${emotion}const Component = styled('div')\`
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
      code: `${emotion}const Component = styled('div')\`
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
      code: `${emotion}const Component = styled('div')\`
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
