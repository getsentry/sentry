import {RuleTester} from '@typescript-eslint/rule-tester';

import {noZIndex} from './no-z-index';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

ruleTester.run('no-z-index', noZIndex, {
  valid: [
    // z-index: 1 is the approved local override in CSS
    {
      code: "const Foo = styled('div')`z-index: 1;`;",
      filename: '/static/app/components/foo.tsx',
    },
    // zIndex: 1 in object form is allowed
    {
      code: 'const style = { zIndex: 1 };',
      filename: '/static/app/components/foo.tsx',
    },
    // zIndex: 1 in JSX style prop is allowed
    {
      code: '<div style={{ zIndex: 1 }} />;',
      filename: '/static/app/components/foo.tsx',
    },
    // zIndex={1} as JSX prop is allowed
    {
      code: '<Foo zIndex={1} />;',
      filename: '/static/app/components/foo.tsx',
    },
    // No z-index at all is fine
    {
      code: "const Bar = styled('div')`color: red;`;",
      filename: '/static/app/components/bar.tsx',
    },
    // Regular objects without zIndex are fine
    {
      code: 'const style = { color: "red" };',
      filename: '/static/app/components/bar.tsx',
    },
    // z-index: 1 with !important is allowed
    {
      code: "const Foo = styled('div')`z-index: 1 !important;`;",
      filename: '/static/app/components/foo.tsx',
    },
  ],

  invalid: [
    // z-index in tagged template with value other than 1
    {
      code: "const Foo = styled('div')`z-index: 10;`;",
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // z-index: 0
    {
      code: "const Foo = styled('div')`z-index: 0;`;",
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // z-index with negative value
    {
      code: "const Foo = styled('div')`z-index: -1;`;",
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // z-index with theme expression (expression is in a quasi boundary, the literal part is just `z-index: `)
    {
      code: "const Foo = styled('div')`z-index: ${theme.zIndex.modal};`;",
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // z-index: 9999
    {
      code: "const Foo = styled('div')`z-index: 9999;`;",
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // zIndex in style object with non-1 value
    {
      code: 'const style = { zIndex: 10 };',
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // zIndex: 0 in object
    {
      code: 'const style = { zIndex: 0 };',
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // zIndex in JSX style prop with non-1 value
    {
      code: '<div style={{ zIndex: 100 }} />;',
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // zIndex as JSX prop with expression
    {
      code: '<PositionWrapper zIndex={theme.zIndex.tooltip} />;',
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // zIndex as JSX prop with non-1 literal
    {
      code: '<Foo zIndex={10} />;',
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
    // zIndex as string value JSX prop
    {
      code: '<Foo zIndex="10" />;',
      filename: '/static/app/components/foo.tsx',
      errors: [{messageId: 'noZIndex'}],
    },
  ],
});
