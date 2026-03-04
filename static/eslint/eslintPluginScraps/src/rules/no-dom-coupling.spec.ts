import {RuleTester} from '@typescript-eslint/rule-tester';

import {noDomCoupling} from './no-dom-coupling';

const ruleTester = new RuleTester();

ruleTester.run('no-dom-coupling', noDomCoupling, {
  valid: [
    // Only top-level styles, no nested selectors
    {
      code: `
        const StyledButton = styled(Button)\`
          padding: 8px;
          min-height: 0;
          color: red;
        \`;
      `,
    },
    // Pseudo-classes on root element
    {
      code: `
        const StyledButton = styled(Button)\`
          &:hover { color: red; }
          &:focus-visible { outline: 2px solid blue; }
          &::before { content: ''; }
          &::after { content: ''; }
        \`;
      `,
    },
    // &.className — class on root element itself
    {
      code: `
        const StyledButton = styled(Button)\`
          &.active { background: blue; }
          &.disabled { opacity: 0.5; }
        \`;
      `,
    },
    // styled('div') — HTML element base, nested selectors are fine
    {
      code: `
        const Wrapper = styled('div')\`
          > span { color: red; }
          .inner { padding: 8px; }
        \`;
      `,
    },
    // styled.div — member expression HTML element
    {
      code: `
        const Wrapper = styled.div\`
          .inner { padding: 8px; }
          > div { margin: 0; }
        \`;
      `,
    },
    // @media query with only properties
    {
      code: `
        const StyledComponent = styled(Component)\`
          padding: 8px;
          @media (max-width: 768px) {
            padding: 4px;
          }
        \`;
      `,
    },
    // Lowercase first arg — not a component
    {
      code: `
        const StyledEl = styled(myElement)\`
          > div { color: red; }
        \`;
      `,
    },
    // Empty template
    {
      code: 'const Styled = styled(Component)``;',
    },
    // Template expressions as property values (not selectors)
    {
      code: `
        const StyledComponent = styled(Component)\`
          color: \${p => p.theme.color};
          margin: \${p => p.theme.space.md};
        \`;
      `,
    },
  ],

  invalid: [
    // Child combinator with HTML element
    {
      code: `
        const StyledTrigger = styled(OverlayTrigger)\`
          > span > div { border-radius: 20px; }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
    // Class selector targeting internal classes
    {
      code: `
        const StyledHovercard = styled(Hovercard)\`
          .loading { margin: 0 auto; }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
    // Bare element selector targeting internal elements
    {
      code: `
        const StyledTextCopyInput = styled(TextCopyInput)\`
          input { height: 38px; }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
    // Descendant combinator with &
    {
      code: `
        const StyledLink = styled(Link)\`
          & div { display: inline; }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
    // & > element
    {
      code: `
        const StyledWrapper = styled(Wrapper)\`
          & > span { color: red; }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
    // Universal child selector > *
    {
      code: `
        const StyledComponent = styled(Component)\`
          > * { margin: 0; }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
    // MemberExpression component: styled(Component.Sub)
    {
      code: `
        const StyledHeader = styled(SimpleTable.Header)\`
          > div { padding: 0; }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
    // Deep child combinator
    {
      code: `
        const StyledTrigger = styled(OverlayTrigger)\`
          > label > div > * { border: none; }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
    // Component reference as selector (interpolation)
    {
      code: `
        const StyledProjectBadge = styled(ProjectBadge)\`
          \${BadgeDisplayName} { max-width: 100%; }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
    // & > svg (common pattern)
    {
      code: `
        const StyledBanner = styled(BannerSummary)\`
          & > svg:last-child {
            margin-right: 0;
          }
        \`;
      `,
      errors: [{messageId: 'nestedSelector'}],
    },
  ],
});
