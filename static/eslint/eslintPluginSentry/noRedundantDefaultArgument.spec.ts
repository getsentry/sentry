import {RuleTester} from '@typescript-eslint/rule-tester';

import {noRedundantDefaultArgument} from './noRedundantDefaultArgument';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {jsx: true},
    },
  },
});

ruleTester.run('no-redundant-default-argument', noRedundantDefaultArgument, {
  valid: [
    {
      name: 'omitted argument',
      code: 'function foo(value = 0) {} foo();',
    },
    {
      name: 'argument differs from default',
      code: 'function foo(value = 0) {} foo(1);',
    },
    {
      name: 'argument is not hardcoded',
      code: 'function foo(value = 0) {} foo(value);',
    },
    {
      name: 'default is not hardcoded',
      code: 'function foo(value = DEFAULT_VALUE) {} foo(5);',
    },
    {
      name: 'later argument prevents omission',
      code: 'function foo(value = 0, other = 1) {} foo(0, 2);',
    },
    {
      name: 'parameter has no default',
      code: 'function foo(value) {} foo(0);',
    },
    {
      name: 'member call is not resolved',
      code: 'const object = {foo(value = 0) {}}; object.foo(0);',
    },
    {
      name: 'mutable function binding is not resolved',
      code: 'let foo = (value = 0) => {}; foo(0);',
    },
    {
      name: 'reassigned function declaration',
      code: 'function foo(value = 0) {} foo = other; foo(0);',
    },
    {
      name: 'shadowed function has a different default',
      code: `
        function foo(value = 0) {}
        function call() {
          function foo(value = 1) {}
          foo(0);
        }
      `,
    },
    {
      name: 'object property differs from default',
      code: 'function foo({value = 0}) {} foo({value: 1});',
    },
    {
      name: 'object property is not hardcoded',
      code: 'function foo({value = 0}) {} foo({value});',
    },
    {
      name: 'later object spread can override the property',
      code: 'function foo({value = 0}) {} foo({value: 0, ...other});',
    },
    {
      name: 'unknown JSX component',
      code: '<Foo value={5} />;',
    },
    {
      name: 'JSX prop differs from default',
      code: 'function Foo({value = 5}) { return null; } <Foo value={6} />;',
    },
    {
      name: 'JSX prop is not hardcoded',
      code: 'function Foo({value = 5}) { return null; } <Foo value={value} />;',
    },
    {
      name: 'later JSX spread can override the prop',
      code: 'function Foo({value = 5}) { return null; } <Foo value={5} {...props} />;',
    },
    {
      name: 'intrinsic JSX element',
      code: 'function div({value = 5}) { return null; } <div value={5} />;',
    },
    {
      name: 'negative zero does not equal positive zero',
      code: 'function foo(value = -0) {} foo(0);',
    },
  ],
  invalid: [
    {
      name: 'function declaration with numeric default',
      code: 'function foo(value = 0) {} foo(0);',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value'},
        },
      ],
    },
    {
      name: 'call before function declaration',
      code: 'foo(0); function foo(value = 0) {}',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'const arrow function with string default',
      code: `const foo = (value = 'all') => {}; foo("all");`,
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'const function expression with boolean default',
      code: 'const foo = function(value = false) {}; foo(false);',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'all trailing arguments use their defaults',
      code: `function foo(enabled = false, mode = 'all') {} foo(false, 'all');`,
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'enabled'},
        },
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'mode'},
        },
      ],
    },
    {
      name: 'negative numeric default',
      code: 'function foo(value = -1) {} foo(-1);',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'template literal equals string default',
      code: 'function foo(value = `all`) {} foo("all");',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'object destructuring in function call',
      code: 'function foo({value = 5}) {} foo({value: 5});',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: 'value'},
        },
      ],
    },
    {
      name: 'renamed object destructuring property',
      code: 'function foo({value: localValue = 5}) {} foo({value: 5});',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: 'value'},
        },
      ],
    },
    {
      name: 'object spread before explicit property',
      code: 'function foo({value = 5}) {} foo({...other, value: 5});',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'function component with numeric JSX prop',
      code: 'function Foo({value = 5}) { return null; } <Foo value={5} />;',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'prop', name: 'value'},
        },
      ],
    },
    {
      name: 'arrow component with string JSX prop',
      code: `const Foo = ({label = 'hello'}) => null; <Foo label="hello" />;`,
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'boolean JSX shorthand',
      code: 'function Foo({enabled = true}) { return null; } <Foo enabled />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'JSX spread before explicit prop',
      code: 'function Foo({value = 5}) { return null; } <Foo {...props} value={5} />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'destructured props parameter with its own default',
      code: 'function Foo({value = 5} = {}) { return null; } <Foo value={5} />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'TypeScript const assertion',
      code: 'const foo = (value = 5 as const) => {}; foo(5 as const);',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
  ],
});
