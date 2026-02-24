import {RuleTester} from 'eslint';

import {restrictJsxSlotChildren} from './restrict-jsx-slot-children.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

// ── Shared fixtures ──────────────────────────────────────────────────────────

const IMPORTS = `
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex, Stack, Grid, Container} from '@sentry/scraps/layout';
`;

/**
 * The CompactSelect slot configuration exercised in all test cases below.
 * Matches the configuration registered in eslint.config.mjs.
 */
const COMPACT_SELECT_OPTIONS = [
  {
    propNames: ['menuHeaderTrailingItems', 'menuFooter'],
    allowed: [
      {
        type: 'member',
        source: '@sentry/scraps/compactSelect',
        objectName: 'MenuComponents',
        role: 'leaf',
      },
      {
        type: 'named',
        source: '@sentry/scraps/layout',
        names: ['Flex', 'Stack', 'Grid', 'Container'],
        role: 'wrapper',
      },
    ],
  },
];

// Pre-computed hint string produced by buildAllowedHint() for the config above
const ALLOWED_HINT =
  "MenuComponents.* from '@sentry/scraps/compactSelect', or Flex, Stack, Grid, Container from '@sentry/scraps/layout'";

/**
 * Shorthand for an expected "forbidden" error for a given element name and prop.
 */
function forbidden(name, prop) {
  return {messageId: 'forbidden', data: {name, prop, allowed: ALLOWED_HINT}};
}

// ── Tests ────────────────────────────────────────────────────────────────────

ruleTester.run('restrict-jsx-slot-children', restrictJsxSlotChildren, {
  valid: [
    // ── menuTitle is not a checked slot ──────────────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuTitle={<CustomComponent />} />`,
      filename: '/static/app/foo.tsx',
    },

    // ── Direct MenuComponents.* elements ─────────────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<MenuComponents.ApplyButton />} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuHeaderTrailingItems={<MenuComponents.HeaderButton>text</MenuComponents.HeaderButton>} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<MenuComponents.Alert variant="warning">msg</MenuComponents.Alert>} />`,
      filename: '/static/app/foo.tsx',
    },

    // ── Layout wrappers containing MenuComponents.* ───────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Flex><MenuComponents.CancelButton/><MenuComponents.ApplyButton/></Flex>} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Stack><MenuComponents.Alert>msg</MenuComponents.Alert></Stack>} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Grid><MenuComponents.CTALinkButton to="/foo">Go</MenuComponents.CTALinkButton></Grid>} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Container><MenuComponents.CTAButton>Go</MenuComponents.CTAButton></Container>} />`,
      filename: '/static/app/foo.tsx',
    },

    // ── Nested layout wrappers ────────────────────────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Flex><Stack><MenuComponents.ApplyButton/></Stack></Flex>} />`,
      filename: '/static/app/foo.tsx',
    },

    // ── Content inside a leaf element is not checked ─────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Flex><MenuComponents.Alert><div>text</div></MenuComponents.Alert></Flex>} />`,
      filename: '/static/app/foo.tsx',
    },

    // ── Arrow function with expression body ───────────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuHeaderTrailingItems={() => <MenuComponents.HeaderButton/>} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={({closeOverlay}) => <MenuComponents.ApplyButton onClick={closeOverlay}/>} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuHeaderTrailingItems={({closeOverlay}) => <Flex><MenuComponents.HeaderButton onClick={closeOverlay}/></Flex>} />`,
      filename: '/static/app/foo.tsx',
    },

    // ── Top-level conditional / logical with valid branches ───────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={condition && <MenuComponents.ApplyButton/>} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={condition ? <MenuComponents.ApplyButton/> : null} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuHeaderTrailingItems={condition ? <MenuComponents.HeaderButton/> : null} />`,
      filename: '/static/app/foo.tsx',
    },

    // ── Falsy / non-JSX prop values are ignored ───────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={null} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={false} />`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={someVar} />`,
      filename: '/static/app/foo.tsx',
    },

    // ── Import aliases are respected ──────────────────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `
import {MenuComponents as MC} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
<CompactSelect menuFooter={<MC.ApplyButton/>} />
`,
      filename: '/static/app/foo.tsx',
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex as FlexLayout} from '@sentry/scraps/layout';
<CompactSelect menuFooter={<FlexLayout><MenuComponents.ApplyButton/></FlexLayout>} />
`,
      filename: '/static/app/foo.tsx',
    },

    // ── Prop not in configured propNames is not checked ──────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<Foo someOtherSlot={<Button/>} />`,
      filename: '/static/app/foo.tsx',
    },
  ],

  invalid: [
    // ── Raw button directly in slot ───────────────────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuHeaderTrailingItems={<Button size="zero" priority="transparent"/>} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Button', 'menuHeaderTrailingItems')],
    },

    // ── Raw button inside layout wrapper ──────────────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Flex><Button/></Flex>} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Button', 'menuFooter')],
    },

    // ── Fragment is not in the allowed set ────────────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Fragment><MenuComponents.ApplyButton/></Fragment>} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Fragment', 'menuFooter')],
    },

    // ── Custom component directly in slot ─────────────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<CustomFooter />} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('CustomFooter', 'menuFooter')],
    },

    // ── Multiple invalid elements inside a layout wrapper ─────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Flex><Button/><LinkButton/></Flex>} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Button', 'menuFooter'), forbidden('LinkButton', 'menuFooter')],
    },

    // ── Invalid in arrow function expression body ─────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuHeaderTrailingItems={() => <Button/>} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Button', 'menuHeaderTrailingItems')],
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={({closeOverlay}) => <Flex><Button onClick={closeOverlay}/></Flex>} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Button', 'menuFooter')],
    },

    // ── Invalid inside logical expression inside a layout wrapper ─────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Flex>{condition && <Button/>}</Flex>} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Button', 'menuFooter')],
    },

    // ── Invalid inside conditional expression inside a layout wrapper ──────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={<Flex>{condition ? <MenuComponents.ApplyButton/> : <Button/>}</Flex>} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Button', 'menuFooter')],
    },

    // ── Top-level conditional with invalid branch ──────────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuFooter={condition ? <Button/> : null} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Button', 'menuFooter')],
    },
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `${IMPORTS}<CompactSelect menuHeaderTrailingItems={condition && <Button/>} />`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Button', 'menuHeaderTrailingItems')],
    },

    // ── MenuComponents not imported → member expression is unknown ────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `
import {Flex} from '@sentry/scraps/layout';
<CompactSelect menuFooter={<MenuComponents.ApplyButton/>} />
`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('MenuComponents.ApplyButton', 'menuFooter')],
    },

    // ── Layout not imported → identifier is unknown ───────────────────────────
    {
      options: COMPACT_SELECT_OPTIONS,
      code: `
import {MenuComponents} from '@sentry/scraps/compactSelect';
<CompactSelect menuFooter={<Flex><MenuComponents.ApplyButton/></Flex>} />
`,
      filename: '/static/app/foo.tsx',
      errors: [forbidden('Flex', 'menuFooter')],
    },
  ],
});
