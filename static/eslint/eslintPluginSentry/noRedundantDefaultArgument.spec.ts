import {RuleTester} from '@typescript-eslint/rule-tester';
import {TSESLint} from '@typescript-eslint/utils';

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
      name: 'spread prevents positional argument alignment',
      code: 'function foo(first, value = 20) {} foo(...values, 20);',
    },
    {
      name: 'later spread prevents positional argument omission',
      code: 'function foo(value = 20, ...rest) {} foo(20, ...values);',
    },
    {
      name: 'object argument after spread is not aligned',
      code: 'function foo(first, {value = 5}) {} foo(...values, {value: 5});',
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
      name: 'earlier object spread can supply the property',
      code: 'function foo({value = 0}) {} foo({...other, value: 0});',
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
      name: 'earlier JSX spread can supply the prop',
      code: 'function Foo({value = 5}) { return null; } <Foo {...props} value={5} />;',
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
      code: 'function foo(defaultPage = 20) {} foo(20);',
      output: 'function foo(defaultPage = 20) {} foo();',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'defaultPage', value: '20'},
        },
      ],
    },
    {
      name: 'call before function declaration',
      code: 'foo(0); function foo(value = 0) {}',
      output: 'foo(); function foo(value = 0) {}',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'const arrow function with string default',
      code: `const foo = (value = 'all') => {}; foo("all");`,
      output: `const foo = (value = 'all') => {}; foo();`,
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'const function expression with boolean default',
      code: 'const foo = function(value = false) {}; foo(false);',
      output: 'const foo = function(value = false) {}; foo();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'all trailing arguments use their defaults',
      code: `function foo(enabled = false, mode = 'all') {} foo(false, 'all');`,
      output: `function foo(enabled = false, mode = 'all') {} foo();`,
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'enabled', value: 'false'},
        },
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'mode', value: '"all"'},
        },
      ],
    },
    {
      name: 'does not remove comments between trailing arguments',
      code: 'function foo(first = false, second = true) {} foo(false, /* keep */ true);',
      output: null,
      errors: [
        {messageId: 'redundantDefaultValue'},
        {messageId: 'redundantDefaultValue'},
      ],
    },
    {
      name: 'negative numeric default',
      code: 'function foo(value = -1) {} foo(-1);',
      output: 'function foo(value = -1) {} foo();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'template literal equals string default',
      code: 'function foo(value = `all`) {} foo("all");',
      output: 'function foo(value = `all`) {} foo();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'object destructuring in function call',
      code: 'function foo({value = 5}) {} foo({value: 5});',
      output: 'function foo({value = 5}) {} foo({});',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: 'value', value: '5'},
        },
      ],
    },
    {
      name: 'renamed object destructuring property',
      code: 'function foo({value: localValue = 5}) {} foo({value: 5});',
      output: 'function foo({value: localValue = 5}) {} foo({});',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: 'value', value: '5'},
        },
      ],
    },
    {
      name: 'object argument before call spread stays aligned',
      code: 'function foo({value = 5}, ...rest) {} foo({value: 5}, ...values);',
      output: 'function foo({value = 5}, ...rest) {} foo({}, ...values);',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'multiple destructured properties use their defaults',
      code: 'function foo({first = 1, second = 2}) {} foo({first: 1, second: 2});',
      output: 'function foo({first = 1, second = 2}) {} foo({});',
      errors: [
        {messageId: 'redundantDefaultValue'},
        {messageId: 'redundantDefaultValue'},
      ],
    },
    {
      name: 'function component with numeric JSX prop',
      code: 'function Foo({value = 5}) { return null; } <Foo value={5} />;',
      output: 'function Foo({value = 5}) { return null; } <Foo />;',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'prop', name: 'value', value: '5'},
        },
      ],
    },
    {
      name: 'arrow component with string JSX prop',
      code: `const Foo = ({label = 'hello'}) => null; <Foo label="hello" />;`,
      output: `const Foo = ({label = 'hello'}) => null; <Foo />;`,
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'boolean JSX shorthand',
      code: 'function Foo({enabled = true}) { return null; } <Foo enabled />;',
      output: 'function Foo({enabled = true}) { return null; } <Foo />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'destructured props parameter with its own default',
      code: 'function Foo({value = 5} = {}) { return null; } <Foo value={5} />;',
      output: 'function Foo({value = 5} = {}) { return null; } <Foo />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'multiple JSX props use their defaults',
      code: 'function Foo({first = 1, second = 2}) { return null; } <Foo first={1} second={2} />;',
      output: 'function Foo({first = 1, second = 2}) { return null; } <Foo />;',
      errors: [
        {messageId: 'redundantDefaultValue'},
        {messageId: 'redundantDefaultValue'},
      ],
    },
    {
      name: 'TypeScript const assertion',
      code: 'const foo = (value = 5 as const) => {}; foo(5 as const);',
      output: 'const foo = (value = 5 as const) => {}; foo();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
  ],
});

const crossFileRuleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: `${__dirname}/fixtures`,
    },
  },
});

crossFileRuleTester.run('no-redundant-default-argument', noRedundantDefaultArgument, {
  valid: [
    {
      name: 'imported function argument differs from default',
      code: `
import {a} from './importedDefault';
a(1);
`,
      filename: 'consumer.ts',
    },
    {
      name: 'imported component prop differs from default',
      code: `
import {Component} from './importedDefault';
<Component value={6} />;
`,
      filename: 'componentConsumer.tsx',
    },
  ],
  invalid: [
    {
      name: 'imported function with numeric default',
      code: `
import {a} from './importedDefault';
a(0);
`,
      filename: 'consumer.ts',
      output: `
import {a} from './importedDefault';
a();
`,
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '0'},
        },
      ],
    },
    {
      name: 'imported function with destructured default',
      code: `
import {withOptions} from './importedDefault';
withOptions({value: 5});
`,
      filename: 'consumer.ts',
      output: `
import {withOptions} from './importedDefault';
withOptions({});
`,
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: 'value', value: '5'},
        },
      ],
    },
    {
      name: 'imported component with destructured default',
      code: `
import {Component} from './importedDefault';
<Component value={5} />;
`,
      filename: 'componentConsumer.tsx',
      output: `
import {Component} from './importedDefault';
<Component />;
`,
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'prop', name: 'value', value: '5'},
        },
      ],
    },
  ],
});

const nonTypeScriptRuleTester = new TSESLint.RuleTester();

nonTypeScriptRuleTester.run('no-redundant-default-argument', noRedundantDefaultArgument, {
  valid: [],
  invalid: [
    {
      name: 'parser without TypeScript parser services',
      code: 'function foo(value = 5) {} foo(5);',
      output: 'function foo(value = 5) {} foo();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
  ],
});
