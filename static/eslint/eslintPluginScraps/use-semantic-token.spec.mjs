import {RuleTester} from 'eslint';

import useSemanticToken from './use-semantic-token.mjs';

const ruleTester = new RuleTester();

ruleTester.run('use-semantic-token', useSemanticToken, {
  valid: [
    // Basic color property with content token
    {
      code: `const Component = styled.div\`
  color: \${p => p.theme.tokens.content.primary};
\`;`,
    },
    // text-decoration-color is allowed
    {
      code: `const Component = styled.div\`
  text-decoration-color: \${p => p.theme.tokens.content.secondary};
\`;`,
    },
    // Multiple valid color properties
    {
      code: `const Component = styled.div\`
  color: \${p => p.theme.tokens.content.primary};
  text-decoration-color: \${p => p.theme.tokens.content.secondary};
  caret-color: \${p => p.theme.tokens.content.accent};
\`;`,
    },
    // Without the `p =>` pattern (direct theme reference)
    {
      code: `const Component = styled.div\`
  color: \${theme.tokens.content.primary};
\`;`,
    },
    // Non-content tokens should be ignored (background tokens with background property)
    {
      code: `const Component = styled.div\`
  background: \${p => p.theme.tokens.background.primary};
\`;`,
    },
    // Non-content tokens should be ignored (border tokens with border-color property)
    {
      code: `const Component = styled.div\`
  border-color: \${p => p.theme.tokens.border.primary};
\`;`,
    },
    // styled(Component) pattern
    {
      code: `const Component = styled(Button)\`
  color: \${p => p.theme.tokens.content.danger};
\`;`,
    },
    // css`` tagged template
    {
      code: `const styles = css\`
  color: \${p => p.theme.tokens.content.warning};
\`;`,
    },
    // Nested content token path (content.onVibrant.light)
    {
      code: `const Component = styled.div\`
  color: \${p => p.theme.tokens.content.onVibrant.light};
\`;`,
    },
    // Using regular string values (not tokens)
    {
      code: `const Component = styled.div\`
  background: red;
  color: blue;
\`;`,
    },
    // -webkit-text-fill-color is allowed
    {
      code: `const Component = styled.div\`
  -webkit-text-fill-color: \${p => p.theme.tokens.content.primary};
\`;`,
    },
    // -webkit-text-stroke-color is allowed
    {
      code: `const Component = styled.div\`
  -webkit-text-stroke-color: \${p => p.theme.tokens.content.secondary};
\`;`,
    },
    // column-rule-color is allowed
    {
      code: `const Component = styled.div\`
  column-rule-color: \${p => p.theme.tokens.content.accent};
\`;`,
    },
    // Nested selector with pseudo-class (a:hover) - color is valid
    {
      code: `const Component = styled.div\`
  a:hover {
    color: \${p => p.theme.tokens.content.primary};
  }
\`;`,
    },
    // Object expression for dynamic color property
    {
      code: `const Component = styled.p\`
  color: \${p =>
    ({
      none: p.theme.tokens.content.secondary,
      alert: p.theme.colors.yellow500,
    })[p.status]};
\`;`,
    },
    // Multiple nested selectors
    {
      code: `const Component = styled.div\`
  &:hover {
    color: \${p => p.theme.tokens.content.accent};
  }
  &:focus {
    color: \${p => p.theme.tokens.content.primary};
  }
\`;`,
    },
    // Pseudo-element with color
    {
      code: `const Component = styled.div\`
  &::before {
    color: \${p => p.theme.tokens.content.secondary};
  }
\`;`,
    },
    // Media query with color
    {
      code: `const Component = styled.div\`
  @media (max-width: 768px) {
    color: \${p => p.theme.tokens.content.primary};
  }
\`;`,
    },
  ],

  invalid: [
    // background with content token
    {
      code: `const Component = styled.div\`
  background: \${p => p.theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'primary', property: 'background'},
        },
      ],
    },
    // border-color with content token
    {
      code: `const Component = styled.div\`
  border-color: \${p => p.theme.tokens.content.accent};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'accent', property: 'border-color'},
        },
      ],
    },
    // fill with content token
    {
      code: `const Component = styled.div\`
  fill: \${p => p.theme.tokens.content.danger};
\`;`,
      errors: [
        {messageId: 'invalidProperty', data: {tokenName: 'danger', property: 'fill'}},
      ],
    },
    // Multiple invalid usages in one component
    {
      code: `const Component = styled.div\`
  background: \${p => p.theme.tokens.content.primary};
  border-color: \${p => p.theme.tokens.content.accent};
  fill: \${p => p.theme.tokens.content.danger};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'primary', property: 'background'},
        },
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'accent', property: 'border-color'},
        },
        {messageId: 'invalidProperty', data: {tokenName: 'danger', property: 'fill'}},
      ],
    },
    // background-color with content token
    {
      code: `const Component = styled.div\`
  background-color: \${p => p.theme.tokens.content.secondary};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'secondary', property: 'background-color'},
        },
      ],
    },
    // stroke with content token
    {
      code: `const Component = styled.div\`
  stroke: \${p => p.theme.tokens.content.warning};
\`;`,
      errors: [
        {messageId: 'invalidProperty', data: {tokenName: 'warning', property: 'stroke'}},
      ],
    },
    // outline-color with content token
    {
      code: `const Component = styled.div\`
  outline-color: \${p => p.theme.tokens.content.success};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'success', property: 'outline-color'},
        },
      ],
    },
    // styled(Component) pattern with invalid usage
    {
      code: `const Component = styled(Button)\`
  background: \${p => p.theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'primary', property: 'background'},
        },
      ],
    },
    // css`` tagged template with invalid usage
    {
      code: `const styles = css\`
  background: \${p => p.theme.tokens.content.accent};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'accent', property: 'background'},
        },
      ],
    },
    // Direct theme reference (without p =>) with invalid usage
    {
      code: `const Component = styled.div\`
  background: \${theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'primary', property: 'background'},
        },
      ],
    },
    // box-shadow with content token (not a valid color property)
    {
      code: `const Component = styled.div\`
  box-shadow: 0 0 5px \${p => p.theme.tokens.content.primary};
\`;`,
      errors: [
        {
          messageId: 'invalidProperty',
          data: {tokenName: 'primary', property: 'box-shadow'},
        },
      ],
    },
  ],
});
