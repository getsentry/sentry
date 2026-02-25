import {RuleTester} from 'eslint';

import {preferTokens} from './prefer-tokens.mjs';

const ruleTester = new RuleTester();

ruleTester.run('prefer-tokens', preferTokens, {
  valid: [
    // Values that don't match any token
    {
      code: `const Component = styled('div')\`
  padding: 10px;
\`;`,
    },
    // Already using theme tokens (expression, not hardcoded)
    {
      code: `const Component = styled('div')\`
  padding: \${p => p.theme.space.md};
\`;`,
    },
    // Non-styled contexts — plain JS objects
    {
      code: `const obj = { padding: '8px' };`,
    },
    // CSS custom properties
    {
      code: `const Component = styled('div')\`
  --spacing: 8px;
\`;`,
    },
    // calc() expressions
    {
      code: `const Component = styled('div')\`
  padding: calc(100% - 8px);
\`;`,
    },
    // Non-pixel units
    {
      code: `const Component = styled('div')\`
  padding: 1rem;
\`;`,
    },
    // Properties not in any size token category
    {
      code: `const Component = styled('div')\`
  width: 8px;
\`;`,
    },
    // Zero without unit
    {
      code: `const Component = styled('div')\`
  padding: 0;
\`;`,
    },
    // var() function
    {
      code: `const Component = styled('div')\`
  margin: var(--spacing);
\`;`,
    },
    // Object style outside styled context
    {
      code: `const config = { borderRadius: '4px' };`,
    },
    // enabledCategories filter — only space enabled, radius should pass
    {
      code: `const Component = styled('div')\`
  border-radius: 6px;
\`;`,
      options: [{enabledCategories: ['space']}],
    },
  ],

  invalid: [
    // Simple spacing — template literal
    {
      code: `const Component = styled('div')\`
  padding: 8px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '8px', tokenAccess: 'space.md'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '8px', tokenAccess: 'space.md'},
              output: `const Component = styled('div')\`
  padding: \${p => p.theme.space.md};
\`;`,
            },
          ],
        },
      ],
    },
    // Shorthand spacing — two components
    {
      code: `const Component = styled('div')\`
  padding: 4px 8px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '4px', tokenAccess: 'space.xs'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '4px', tokenAccess: 'space.xs'},
              output: `const Component = styled('div')\`
  padding: \${p => p.theme.space.xs} 8px;
\`;`,
            },
          ],
        },
        {
          messageId: 'preferToken',
          data: {rawValue: '8px', tokenAccess: 'space.md'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '8px', tokenAccess: 'space.md'},
              output: `const Component = styled('div')\`
  padding: 4px \${p => p.theme.space.md};
\`;`,
            },
          ],
        },
      ],
    },
    // Border radius
    {
      code: `const Component = styled('div')\`
  border-radius: 6px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '6px', tokenAccess: 'radius.md'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '6px', tokenAccess: 'radius.md'},
              output: `const Component = styled('div')\`
  border-radius: \${p => p.theme.radius.md};
\`;`,
            },
          ],
        },
      ],
    },
    // Border width
    {
      code: `const Component = styled('div')\`
  border-width: 1px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '1px', tokenAccess: 'border.md'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '1px', tokenAccess: 'border.md'},
              output: `const Component = styled('div')\`
  border-width: \${p => p.theme.border.md};
\`;`,
            },
          ],
        },
      ],
    },
    // Category disambiguation: 4px with border-radius → radius.xs (not space.xs)
    {
      code: `const Component = styled('div')\`
  border-radius: 4px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '4px', tokenAccess: 'radius.xs'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '4px', tokenAccess: 'radius.xs'},
              output: `const Component = styled('div')\`
  border-radius: \${p => p.theme.radius.xs};
\`;`,
            },
          ],
        },
      ],
    },
    // Bracket-notation token names (2xl)
    {
      code: `const Component = styled('div')\`
  padding: 24px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '24px', tokenAccess: "space['2xl']"},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '24px', tokenAccess: "space['2xl']"},
              output: `const Component = styled('div')\`
  padding: \${p => p.theme.space['2xl']};
\`;`,
            },
          ],
        },
      ],
    },
    // styled.div member expression pattern
    {
      code: `const Component = styled.div\`
  margin: 16px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '16px', tokenAccess: 'space.xl'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '16px', tokenAccess: 'space.xl'},
              output: `const Component = styled.div\`
  margin: \${p => p.theme.space.xl};
\`;`,
            },
          ],
        },
      ],
    },
    // css tagged template
    {
      code: `const styles = css\`
  gap: 12px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '12px', tokenAccess: 'space.lg'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '12px', tokenAccess: 'space.lg'},
              output: `const styles = css\`
  gap: \${p => p.theme.space.lg};
\`;`,
            },
          ],
        },
      ],
    },
    // Object style in styled context
    {
      code: `const Component = styled('div')({
  padding: '8px',
});`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '8px', tokenAccess: 'space.md'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '8px', tokenAccess: 'space.md'},
              output: `const Component = styled('div')({
  padding: p.theme.space.md,
});`,
            },
          ],
        },
      ],
    },
    // camelCase property in object style
    {
      code: `const Component = styled('div')({
  paddingTop: '8px',
});`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '8px', tokenAccess: 'space.md'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '8px', tokenAccess: 'space.md'},
              output: `const Component = styled('div')({
  paddingTop: p.theme.space.md,
});`,
            },
          ],
        },
      ],
    },
    // Object style in styled(Comp)({...})
    {
      code: `const Component = styled(Button)({
  borderRadius: '4px',
});`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '4px', tokenAccess: 'radius.xs'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '4px', tokenAccess: 'radius.xs'},
              output: `const Component = styled(Button)({
  borderRadius: p.theme.radius.xs,
});`,
            },
          ],
        },
      ],
    },
    // Multiple properties
    {
      code: `const Component = styled('div')\`
  padding: 8px;
  margin-top: 16px;
  border-radius: 6px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '8px', tokenAccess: 'space.md'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '8px', tokenAccess: 'space.md'},
              output: `const Component = styled('div')\`
  padding: \${p => p.theme.space.md};
  margin-top: 16px;
  border-radius: 6px;
\`;`,
            },
          ],
        },
        {
          messageId: 'preferToken',
          data: {rawValue: '16px', tokenAccess: 'space.xl'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '16px', tokenAccess: 'space.xl'},
              output: `const Component = styled('div')\`
  padding: 8px;
  margin-top: \${p => p.theme.space.xl};
  border-radius: 6px;
\`;`,
            },
          ],
        },
        {
          messageId: 'preferToken',
          data: {rawValue: '6px', tokenAccess: 'radius.md'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '6px', tokenAccess: 'radius.md'},
              output: `const Component = styled('div')\`
  padding: 8px;
  margin-top: 16px;
  border-radius: \${p => p.theme.radius.md};
\`;`,
            },
          ],
        },
      ],
    },
    // enabledCategories — only space, should still report space violations
    {
      code: `const Component = styled('div')\`
  padding: 8px;
\`;`,
      options: [{enabledCategories: ['space']}],
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '8px', tokenAccess: 'space.md'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '8px', tokenAccess: 'space.md'},
              output: `const Component = styled('div')\`
  padding: \${p => p.theme.space.md};
\`;`,
            },
          ],
        },
      ],
    },
    // 999px border-radius (full)
    {
      code: `const Component = styled('div')\`
  border-radius: 999px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '999px', tokenAccess: 'radius.full'},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '999px', tokenAccess: 'radius.full'},
              output: `const Component = styled('div')\`
  border-radius: \${p => p.theme.radius.full};
\`;`,
            },
          ],
        },
      ],
    },
    // 0px spacing
    {
      code: `const Component = styled('div')\`
  padding: 0px;
\`;`,
      errors: [
        {
          messageId: 'preferToken',
          data: {rawValue: '0px', tokenAccess: "space['0']"},
          suggestions: [
            {
              messageId: 'replaceWithToken',
              data: {rawValue: '0px', tokenAccess: "space['0']"},
              output: `const Component = styled('div')\`
  padding: \${p => p.theme.space['0']};
\`;`,
            },
          ],
        },
      ],
    },
  ],
});
