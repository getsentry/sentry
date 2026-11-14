import {RuleTester} from 'oxlint/plugins-dev';

import {noRedundantDefaultArgument} from './noRedundantDefaultArgument';

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      lang: 'tsx',
    },
  },
});

it('refreshes cached imported defaults after the source file changes', () => {
  const consumer = `${__dirname}/fixtures/consumer.ts`;
  const dependency = `${__dirname}/fixtures/mutableImportedDefault.ts`;
  const originalDependency = 'export function mutableDefault(value = 1) {}';
  const call = (value: number) =>
    `import {mutableDefault} from './mutableImportedDefault'; mutableDefault(${value});`;
  const output =
    "import {mutableDefault} from './mutableImportedDefault'; mutableDefault();";
  const tester = new RuleTester();
  const originalDescribe = RuleTester.describe;
  const originalIt = RuleTester.it;

  // Run every lint pass synchronously inside this one Jest test.
  RuleTester.describe = (_name, run) => run();
  RuleTester.it = (_name, run) => run();
  try {
    tester.run('initial default', noRedundantDefaultArgument, {
      valid: [],
      invalid: [{code: call(1), filename: consumer, errors: 1, output}],
    });
    tester.run('update dependency', noRedundantDefaultArgument, {
      valid: [
        {code: 'export function mutableDefault(value = 2) {}', filename: dependency},
      ],
      invalid: [],
    });
    tester.run('old default is allowed', noRedundantDefaultArgument, {
      valid: [{code: call(1), filename: consumer}],
      invalid: [],
    });
    tester.run('new default is redundant', noRedundantDefaultArgument, {
      valid: [],
      invalid: [{code: call(2), filename: consumer, errors: 1, output}],
    });
  } finally {
    try {
      tester.run('restore dependency', noRedundantDefaultArgument, {
        valid: [{code: originalDependency, filename: dependency}],
        invalid: [],
      });
    } finally {
      RuleTester.describe = originalDescribe;
      RuleTester.it = originalIt;
    }
  }
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
    {
      name: 'this parameter does not shift positional arguments',
      code: 'function foo(this: Window, first = 0, second = 1) {} foo(5, 0);',
    },
    {
      name: 'array destructured parameter',
      code: 'function foo([value] = [0]) {} foo([0]);',
    },
    {
      name: 'object property default is not hardcoded',
      code: 'function foo({value = DEFAULT_VALUE}) {} foo({value: 5});',
    },
    {
      name: 'computed object property',
      code: 'function foo({[key]: value = 5}) {} foo({[key]: 5});',
    },
    {
      name: 'template literal with an expression',
      code: 'function foo(value = `all`) {} foo(`all${suffix}`);',
    },
    {
      name: 'unary operator other than plus or minus',
      code: 'function foo(value = -1) {} foo(~1);',
    },
    {
      name: 'unary plus on a bigint',
      code: 'function foo(value = -1n) {} foo(+1n);',
    },
    {
      name: 'unary plus on a string',
      code: "function foo(value = '1') {} foo(+'1');",
    },
    {
      name: 'unary minus on a string',
      code: "function foo(value = -1) {} foo(-'1');",
    },
    {
      name: 'regular expression literal',
      code: 'function foo(value = /a/) {} foo(/a/);',
    },
    {
      name: 'string argument does not equal numeric default',
      code: 'function foo(value = 5) {} foo("5");',
    },
    {
      name: 'arguments beyond the parameters',
      code: 'function foo(value = 0) {} foo(0, 0);',
    },
    {
      name: 'undeclared callee',
      code: 'undeclared(0);',
    },
    {
      name: 'anonymous default exported function',
      code: 'export default function ({value = 5}) { return null; }',
    },
    {
      name: 'object spread with a hardcoded trailing argument',
      code: 'function foo({value = 5}, other = 0) {} foo({value: 5, ...rest}, 1);',
    },
    {
      name: 'hardcoded argument after a call spread',
      code: 'function foo({first = 1}, second, value = 20) {} foo({first: 2}, ...values, 20);',
    },
    {
      name: 'object argument after a call spread with an aligned object before it',
      code: 'function foo({first = 1}, second, {value = 5}) {} foo({first: 2}, ...values, {value: 5});',
    },
    {
      name: 'duplicate object property',
      code: 'function foo({value = 5}) {} foo({value: 6, value: 5});',
    },
    {
      name: 'object argument without a destructured parameter',
      code: 'function foo(first, second = 1) {} foo({value: 1}, 2);',
    },
    {
      name: 'let function binding is not resolved',
      code: 'let Foo = ({value = 5}) => null; <Foo value={5} />;',
    },
    {
      name: 'member call with a hardcoded object property',
      code: 'function foo({value = 5}) {} object.foo({value: 5});',
    },
    {
      name: 'reassigned component',
      code: 'function Foo({value = 5}) { return null; } Foo = Other; <Foo value={5} />;',
    },
    {
      name: 'JSX member expression',
      code: 'function Foo({value = 5}) { return null; } <Foo.Bar value={5} />;',
    },
    {
      name: 'JSX namespaced prop',
      code: 'function Foo({value = 5}) { return null; } <Foo ns:value={5} />;',
    },
    {
      name: 'JSX string prop does not equal numeric default',
      code: 'function Foo({value = 5}) { return null; } <Foo value="5" />;',
    },
    {
      name: 'JSX prop without a default',
      code: 'function Foo({value = 5, other}) { return null; } <Foo other={5} />;',
    },
    {
      name: 'duplicate JSX prop',
      code: 'function Foo({value = 5}) { return null; } <Foo value={6} value={5} />;',
    },
    {
      name: 'component without a destructured props parameter',
      code: 'function Foo(props, value = 5) { return null; } <Foo value={5} />;',
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
      name: 'this parameter is not a positional argument',
      code: 'function foo(this: Window, value = 0) {} foo(0);',
      output: 'function foo(this: Window, value = 0) {} foo();',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '0'},
        },
      ],
    },
    {
      name: 'null default',
      code: 'function foo(value = null) {} foo(null);',
      output: 'function foo(value = null) {} foo();',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: 'null'},
        },
      ],
    },
    {
      name: 'true default',
      code: 'function foo(value = true) {} foo(true);',
      output: 'function foo(value = true) {} foo();',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: 'true'},
        },
      ],
    },
    {
      name: 'bigint default',
      code: 'function foo(value = 10n) {} foo(10n);',
      output: 'function foo(value = 10n) {} foo();',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '10n'},
        },
      ],
    },
    {
      name: 'negative bigint default',
      code: 'function foo(value = -10n) {} foo(-10n);',
      output: 'function foo(value = -10n) {} foo();',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '-10n'},
        },
      ],
    },
    {
      name: 'unary plus numeric argument',
      code: 'function foo(value = 1) {} foo(+1);',
      output: 'function foo(value = 1) {} foo();',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '1'},
        },
      ],
    },
    {
      name: 'negative zero default',
      code: 'function foo(value = -0) {} foo(-0);',
      output: 'function foo(value = -0) {} foo();',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '-0'},
        },
      ],
    },
    {
      name: 'non-null assertion',
      code: 'function foo(value = 1) {} foo(1!);',
      output: 'function foo(value = 1) {} foo();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'satisfies expression',
      code: 'function foo(value = 1) {} foo(1 satisfies number);',
      output: 'function foo(value = 1) {} foo();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'angle bracket type assertion',
      code: 'function foo(value = 1) {} foo(<number>1);',
      languageOptions: {parserOptions: {lang: 'ts'}},
      output: 'function foo(value = 1) {} foo();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'parenthesized argument',
      code: 'function foo(value = 0) {} foo((0));',
      output: 'function foo(value = 0) {} foo();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'parenthesized argument after a kept argument',
      code: 'function foo(first, value = 0) {} foo(1, (0));',
      output: 'function foo(first, value = 0) {} foo(1);',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'parenthesized kept argument',
      code: 'function foo(first, value = 0) {} foo((1), 0);',
      output: 'function foo(first, value = 0) {} foo((1));',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'trailing comma after removed argument',
      code: 'function foo(first, value = 0) {} foo(1, 0,);',
      output: 'function foo(first, value = 0) {} foo(1);',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'type arguments before removed arguments',
      code: 'function foo<T>(value = 0) {} foo<string>(0);',
      output: 'function foo<T>(value = 0) {} foo<string>();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'optional call',
      code: 'function foo(value = 0) {} foo?.(0);',
      output: 'function foo(value = 0) {} foo?.();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'parenthesized callee',
      code: 'function foo(value = 0) {} (foo)(0);',
      output: 'function foo(value = 0) {} (foo)();',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'removes trailing arguments across lines',
      code: 'function foo(first, value = 0) {}\nfoo(\n  1,\n  0,\n);',
      output: 'function foo(first, value = 0) {}\nfoo(\n  1\n);',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'only trailing defaulted arguments are reported',
      code: 'function foo(first = 0, second = 1, third = 2) {} foo(0, 3, 2);',
      output: 'function foo(first = 0, second = 1, third = 2) {} foo(0, 3);',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'third', value: '2'},
        },
      ],
    },
    {
      name: 'non-object argument for a destructured parameter',
      code: 'function foo({value = 5}, other = 0) {} foo(options, 0);',
      output: 'function foo({value = 5}, other = 0) {} foo(options);',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'comments outside the removed arguments are kept',
      code: 'function foo(first, value = 0) {} /* before */ foo(1, 0); /* after */',
      output: 'function foo(first, value = 0) {} /* before */ foo(1); /* after */',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'object pattern with a rest element',
      code: 'function foo({value = 5, ...rest}) {} foo({value: 5});',
      output: 'function foo({value = 5, ...rest}) {} foo({});',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'does not remove a comment in a later object property range',
      code: 'function foo({first = 1, second = 2}) {} foo({first: 1, keep: 3, /* keep */ second: 2});',
      output: null,
      errors: [
        {messageId: 'redundantDefaultValue'},
        {messageId: 'redundantDefaultValue'},
      ],
    },
    {
      name: 'does not remove a comment in a later JSX prop range',
      code: 'function Foo({first = 1, second = 2}) { return null; } <Foo first={1} keep={3} /* keep */ second={2} />;',
      output: null,
      errors: [
        {messageId: 'redundantDefaultValue'},
        {messageId: 'redundantDefaultValue'},
      ],
    },
    {
      name: 'quoted object property key',
      code: "function foo({'quoted-key': value = 1}) {} foo({'quoted-key': 1});",
      output: "function foo({'quoted-key': value = 1}) {} foo({});",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: 'quoted-key', value: '1'},
        },
      ],
    },
    {
      name: 'numeric object property key',
      code: 'function foo({1: value = 1}) {} foo({1.0: 1});',
      output: 'function foo({1: value = 1}) {} foo({});',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: '1', value: '1'},
        },
      ],
    },
    {
      name: 'removes the last object property after a kept property',
      code: 'function foo({first = 1, second = 2}) {} foo({first: 3, second: 2});',
      output: 'function foo({first = 1, second = 2}) {} foo({first: 3});',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: 'second', value: '2'},
        },
      ],
    },
    {
      name: 'removes object properties around a kept property',
      code: 'function foo({first = 1, second = 2, third = 3}) {} foo({first: 1, second: 4, third: 3,});',
      output: 'function foo({first = 1, second = 2, third = 3}) {} foo({second: 4});',
      errors: [
        {messageId: 'redundantDefaultValue'},
        {messageId: 'redundantDefaultValue'},
      ],
    },
    {
      name: 'does not remove comments between object properties',
      code: 'function foo({first = 1, second = 2}) {} foo({first: 1, /* keep */ second: 2});',
      output: null,
      errors: [
        {messageId: 'redundantDefaultValue'},
        {messageId: 'redundantDefaultValue'},
      ],
    },
    {
      name: 'object property after a method',
      code: 'function foo({value = 5}) {} foo({method() {}, value: 5});',
      output: 'function foo({value = 5}) {} foo({method() {}});',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'object argument with a positional default before it',
      code: 'function foo(first = 0, {value = 5}) {} foo(0, {value: 5});',
      output: 'function foo(first = 0, {value = 5}) {} foo(0, {});',
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: 'value', value: '5'},
        },
      ],
    },
    {
      name: 'object argument followed by a hardcoded argument',
      code: 'function foo({value = 5}, other) {} foo({value: 5}, 1);',
      output: 'function foo({value = 5}, other) {} foo({}, 1);',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'string JSX prop',
      code: "function Foo({label = 'hello'}) { return null; } <Foo label={'hello'} />;",
      output: "function Foo({label = 'hello'}) { return null; } <Foo />;",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'prop', name: 'label', value: '"hello"'},
        },
      ],
    },
    {
      name: 'JSX prop before a kept prop',
      code: 'function Foo({value = 5}) { return null; } <Foo value={5} other={6} />;',
      output: 'function Foo({value = 5}) { return null; } <Foo other={6} />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'JSX prop after a kept prop',
      code: 'function Foo({value = 5}) { return null; } <Foo other={6} value={5} />;',
      output: 'function Foo({value = 5}) { return null; } <Foo other={6} />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'JSX props around a kept prop',
      code: 'function Foo({first = 1, second = 2}) { return null; } <Foo first={1} other={6} second={2} />;',
      output: 'function Foo({first = 1, second = 2}) { return null; } <Foo other={6} />;',
      errors: [
        {messageId: 'redundantDefaultValue'},
        {messageId: 'redundantDefaultValue'},
      ],
    },
    {
      name: 'JSX prop with no whitespace before the next prop',
      code: 'function Foo({a = 1, b = 2}) { return null; } <Foo a={1}b={3} />;',
      output: 'function Foo({a = 1, b = 2}) { return null; } <Foo b={3} />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'JSX prop after a comment before the next prop',
      code: 'function Foo({a = 1, d = 2}) { return null; } <Foo /* c */ a={1} d={3} />;',
      output: 'function Foo({a = 1, d = 2}) { return null; } <Foo /* c */ d={3} />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'duplicate object property does not hide other properties',
      code: 'function foo({a = 1, b = 2}) {} foo({a: 3, a: 4, b: 2});',
      output: 'function foo({a = 1, b = 2}) {} foo({a: 3, a: 4});',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'duplicate JSX prop does not hide other props',
      code: 'function Foo({b = 2, c = 1}) { return null; } <Foo c={3} c={4} b={2} />;',
      output: 'function Foo({b = 2, c = 1}) { return null; } <Foo c={3} c={4} />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'JSX type arguments are kept',
      code: 'function Foo<T>({value = 5}) { return null; } <Foo<string> value={5} />;',
      output: 'function Foo<T>({value = 5}) { return null; } <Foo<string> />;',
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'does not remove comments between JSX props',
      code: 'function Foo({first = 1, second = 2}) { return null; } <Foo first={1} /* keep */ second={2} />;',
      output: null,
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

ruleTester.run('no-redundant-default-argument with imports', noRedundantDefaultArgument, {
  valid: [
    {
      name: 'imported function argument differs from default',
      code: `
import {a} from './importedDefault';
a(1);
`,
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'imported component prop differs from default',
      code: `
import {Component} from './importedDefault';
<Component value={6} />;
`,
      filename: `${__dirname}/fixtures/componentConsumer.tsx`,
    },
    {
      name: 'imported bitwise not default',
      code: "import {bitwiseNot} from './importedDefaultKinds'; bitwiseNot(1);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'imported bitwise not bigint default',
      code: "import {bitwiseNotBig} from './importedDefaultKinds'; bitwiseNotBig(-1n);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'imported local const that is shadowed by a renamed export',
      code: "import {shadowedConst} from './importedDefaultKinds'; shadowedConst(14);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'default exported class',
      code: "import DefaultClass from './defaultClass'; DefaultClass(16);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'imported default is not hardcoded',
      code: "import {notHardcoded} from './importedDefaultKinds'; notHardcoded(5);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'imported this parameter does not shift positional arguments',
      code: "import {withThis} from './importedDefaultKinds'; withThis(5, 0);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'imported non-function constant',
      code: "import {notFunction} from './importedDefaultKinds'; notFunction(7);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'imported declaration without an initializer',
      code: "import {declared} from './importedDefaultKinds'; declared(0);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'imported local that is shadowed by a renamed export',
      code: "import {shadowed} from './importedDefaultKinds'; shadowed(9);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'export star as namespace does not re-export members',
      code: "import {a} from './importedDefaultKinds'; a(0);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'export star does not re-export the default',
      code: "import defaultFunction from './defaultBarrel'; defaultFunction(1);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'unresolved module',
      code: "import {a} from './doesNotExist'; a(0);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'circular export star',
      code: "import {missing} from './cycleA'; missing(0);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
    {
      name: 'namespace import',
      code: "import * as namespace from './importedDefault'; namespace.a(0);",
      filename: `${__dirname}/fixtures/consumer.ts`,
    },
  ],
  invalid: [
    {
      name: 'imported function with numeric default',
      code: `
import {a} from './importedDefault';
a(0);
`,
      filename: `${__dirname}/fixtures/consumer.ts`,
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
      filename: `${__dirname}/fixtures/consumer.ts`,
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
      filename: `${__dirname}/fixtures/componentConsumer.tsx`,
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
    {
      name: 'aliased barrel export',
      code: "import {aliasedA} from './reexportedDefault'; aliasedA(0);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {aliasedA} from './reexportedDefault'; aliasedA();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'export star',
      code: "import {a} from './reexportedDefault'; a(0);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {a} from './reexportedDefault'; a();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'default import',
      code: "import defaulted from './importedDefault'; defaulted(10);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import defaulted from './importedDefault'; defaulted();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported destructured parameter with its own default',
      code: "import {withDefaultedOptions} from './importedDefaultKinds'; withDefaultedOptions({value: 5});",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output:
        "import {withDefaultedOptions} from './importedDefaultKinds'; withDefaultedOptions({});",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported function merged with a type',
      code: "import {MergedName} from './importedDefaultKinds'; MergedName(11);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {MergedName} from './importedDefaultKinds'; MergedName();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported local function merged with a type',
      code: "import {localMerged} from './importedDefaultKinds'; localMerged(12);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {localMerged} from './importedDefaultKinds'; localMerged();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported local overloaded function',
      code: "import {localOverloaded} from './importedDefaultKinds'; localOverloaded(10);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output:
        "import {localOverloaded} from './importedDefaultKinds'; localOverloaded();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'default exported overloaded function',
      code: "import defaultOverloaded from './defaultOverloaded'; defaultOverloaded(15);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import defaultOverloaded from './defaultOverloaded'; defaultOverloaded();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported string default',
      code: "import {text} from './importedDefaultKinds'; text('all');",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {text} from './importedDefaultKinds'; text();",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '"all"'},
        },
      ],
    },
    {
      name: 'imported template literal default',
      code: "import {template} from './importedDefaultKinds'; template('all');",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {template} from './importedDefaultKinds'; template();",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '"all"'},
        },
      ],
    },
    {
      name: 'imported negative numeric default',
      code: "import {negative} from './importedDefaultKinds'; negative(-1);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {negative} from './importedDefaultKinds'; negative();",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '-1'},
        },
      ],
    },
    {
      name: 'imported unary plus numeric default',
      code: "import {positive} from './importedDefaultKinds'; positive(1);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {positive} from './importedDefaultKinds'; positive();",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '1'},
        },
      ],
    },
    {
      name: 'imported bigint default',
      code: "import {big} from './importedDefaultKinds'; big(10n);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {big} from './importedDefaultKinds'; big();",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '10n'},
        },
      ],
    },
    {
      name: 'imported negative bigint default',
      code: "import {negativeBig} from './importedDefaultKinds'; negativeBig(-10n);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {negativeBig} from './importedDefaultKinds'; negativeBig();",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: '-10n'},
        },
      ],
    },
    {
      name: 'imported true default',
      code: "import {enabled} from './importedDefaultKinds'; enabled(true);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {enabled} from './importedDefaultKinds'; enabled();",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: 'true'},
        },
      ],
    },
    {
      name: 'imported false default',
      code: "import {disabled} from './importedDefaultKinds'; disabled(false);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {disabled} from './importedDefaultKinds'; disabled();",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: 'false'},
        },
      ],
    },
    {
      name: 'imported null default',
      code: "import {empty} from './importedDefaultKinds'; empty(null);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {empty} from './importedDefaultKinds'; empty();",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'value', value: 'null'},
        },
      ],
    },
    {
      name: 'imported default with satisfies and as',
      code: "import {wrapped} from './importedDefaultKinds'; wrapped(5);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {wrapped} from './importedDefaultKinds'; wrapped();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported default with an angle bracket assertion',
      code: "import {angleAsserted} from './importedDefaultKinds'; angleAsserted(5);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {angleAsserted} from './importedDefaultKinds'; angleAsserted();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported default with a non-null assertion',
      code: "import {nonNull} from './importedDefaultKinds'; nonNull(5);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {nonNull} from './importedDefaultKinds'; nonNull();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported this parameter is not a positional argument',
      code: "import {withThis} from './importedDefaultKinds'; withThis(1, 1);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {withThis} from './importedDefaultKinds'; withThis(1);",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'argument', name: 'second', value: '1'},
        },
      ],
    },
    {
      name: 'imported quoted destructured key',
      code: "import {withKeys} from './importedDefaultKinds'; withKeys({'quoted-key': 1});",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {withKeys} from './importedDefaultKinds'; withKeys({});",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: 'quoted-key', value: '1'},
        },
      ],
    },
    {
      name: 'imported numeric destructured key',
      code: "import {withKeys} from './importedDefaultKinds'; withKeys({2: 2});",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {withKeys} from './importedDefaultKinds'; withKeys({});",
      errors: [
        {
          messageId: 'redundantDefaultValue',
          data: {kind: 'property', name: '2', value: '2'},
        },
      ],
    },
    {
      name: 'imported overloaded function',
      code: "import {overloaded} from './importedDefaultKinds'; overloaded(3);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {overloaded} from './importedDefaultKinds'; overloaded();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported arrow function',
      code: "import {arrow} from './importedDefaultKinds'; arrow(4);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {arrow} from './importedDefaultKinds'; arrow();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported function expression in a declaration list',
      code: "import {expression} from './importedDefaultKinds'; expression(5);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {expression} from './importedDefaultKinds'; expression();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported arrow function with a type assertion',
      code: "import {asserted} from './importedDefaultKinds'; asserted(6);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {asserted} from './importedDefaultKinds'; asserted();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported renamed local export',
      code: "import {renamedLocal} from './importedDefaultKinds'; renamedLocal(8);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {renamedLocal} from './importedDefaultKinds'; renamedLocal();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'imported renamed export shadowing a local',
      code: "import {shadowed} from './importedDefaultKinds'; shadowed(8);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {shadowed} from './importedDefaultKinds'; shadowed();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'default exported function declaration',
      code: "import defaultFunction from './defaultFunction'; defaultFunction(1);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import defaultFunction from './defaultFunction'; defaultFunction();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'default exported arrow function',
      code: "import defaultArrow from './defaultArrow'; defaultArrow(2);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import defaultArrow from './defaultArrow'; defaultArrow();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'default exported identifier',
      code: "import identity from './defaultIdentifier'; identity(3);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import identity from './defaultIdentifier'; identity();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 're-exported default as a named export',
      code: "import {renamedDefault} from './defaultBarrel'; renamedDefault(2);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {renamedDefault} from './defaultBarrel'; renamedDefault();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 're-exported default import',
      code: "import {importedDefault} from './defaultBarrel'; importedDefault(3);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {importedDefault} from './defaultBarrel'; importedDefault();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 're-exported renamed named import',
      code: "import {importedText} from './defaultBarrel'; importedText('all');",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {importedText} from './defaultBarrel'; importedText();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
    {
      name: 'string import name',
      code: "import {'a' as renamed} from './importedDefault'; renamed(0);",
      filename: `${__dirname}/fixtures/consumer.ts`,
      output: "import {'a' as renamed} from './importedDefault'; renamed();",
      errors: [{messageId: 'redundantDefaultValue'}],
    },
  ],
});
