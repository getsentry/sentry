import {RuleTester} from 'eslint';

import noRenderHookArrowFunction from './no-renderHook-arrow-function.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

ruleTester.run('no-renderHook-arrow-function', noRenderHookArrowFunction, {
  valid: [
    {
      code: 'renderHook(useMyHook)',
      name: 'Hook passed directly without arguments',
    },
    {
      code: 'renderHook(useMyHook, {initialProps: props})',
      name: 'Hook passed directly with initialProps',
    },
    {
      code: 'renderHook(p => useMyHook(p), {initialProps: props})',
      name: 'Arrow function that uses its parameter (correct pattern)',
    },
    {
      code: 'renderHook((p) => useMyHook(p.foo), {initialProps: {foo: "bar"}})',
      name: 'Arrow function that uses destructured parameter',
    },
    {
      code: 'renderHookWithProviders(useMyHook)',
      name: 'renderHookWithProviders with hook passed directly',
    },
    {
      code: 'renderHookWithProviders(p => useMyHook(p), {initialProps: props})',
      name: 'renderHookWithProviders with arrow function using parameter',
    },
    {
      code: 'renderHook(({fact, dep}) => useMemoWithPrevious(fact, [dep]), {initialProps: {fact: factory, dep: firstDep}})',
      name: 'Arrow function with destructured object parameters that are used',
    },
    {
      code: 'renderHook(([a, b]) => useMyHook(a, b), {initialProps: [1, 2]})',
      name: 'Arrow function with destructured array parameters that are used',
    },
    {
      code: 'renderHook(({a: renamed}) => useMyHook(renamed), {initialProps: {a: value}})',
      name: 'Arrow function with renamed destructured parameter that is used',
    },
  ],
  invalid: [
    {
      code: 'renderHook(() => useMyHook())',
      output: 'renderHook(useMyHook)',
      errors: [
        {
          messageId: 'arrowFunctionWithoutParams',
          data: {hookName: 'useMyHook'},
        },
      ],
      name: 'Arrow function with no parameters calling hook with no args (auto-fixable)',
    },
    {
      code: 'renderHook(() => useMyHook(props))',
      output: 'renderHook(useMyHook, {initialProps: props})',
      errors: [
        {
          messageId: 'arrowFunctionWithoutParams',
          data: {hookName: 'useMyHook'},
        },
      ],
      name: 'Arrow function with no parameters calling hook with single arg',
    },
    {
      code: 'renderHook(() => useMyHook(orgSlug), {wrapper})',
      output: 'renderHook(useMyHook, {wrapper, initialProps: orgSlug})',
      errors: [
        {
          messageId: 'arrowFunctionWithoutParams',
          data: {hookName: 'useMyHook'},
        },
      ],
      name: 'Arrow function with hook call and existing options object',
    },
    {
      code: 'renderHookWithProviders(() => useMyHook(DemoTour.RELEASES))',
      output: 'renderHookWithProviders(useMyHook, {initialProps: DemoTour.RELEASES})',
      errors: [
        {
          messageId: 'arrowFunctionWithoutParams',
          data: {hookName: 'useMyHook'},
        },
      ],
      name: 'renderHookWithProviders with arrow function',
    },
    {
      code: 'renderHook((props) => useMyHook(staticValue))',
      output: 'renderHook(useMyHook, {initialProps: staticValue})',
      errors: [
        {
          messageId: 'unnecessaryArrowFunction',
          data: {hookName: 'useMyHook', props: 'staticValue'},
        },
      ],
      name: 'Arrow function with parameter but not using it',
    },
    {
      code: 'renderHook((_unused) => useMyHook(foo, bar))',
      output: null, // Can't auto-fix multiple arguments
      errors: [
        {
          messageId: 'unnecessaryArrowFunction',
          data: {hookName: 'useMyHook', props: 'foo, bar'},
        },
      ],
      name: 'Arrow function with unused parameter and multiple hook args (no auto-fix)',
    },
    {
      code: 'renderHook((props) => useMyHook(value), {wrapper})',
      output: 'renderHook(useMyHook, {wrapper, initialProps: value})',
      errors: [
        {
          messageId: 'unnecessaryArrowFunction',
          data: {hookName: 'useMyHook', props: 'value'},
        },
      ],
      name: 'Arrow function with unused parameter and existing options object',
    },
    {
      code: 'renderHook((p) => useMyHook(a, b), {wrapper, otherOption: true})',
      output: null, // Can't auto-fix multiple arguments
      errors: [
        {
          messageId: 'unnecessaryArrowFunction',
          data: {hookName: 'useMyHook', props: 'a, b'},
        },
      ],
      name: 'Arrow function with unused parameter, multiple args, and existing options (no auto-fix)',
    },
    {
      code: 'renderHook(() => useMyHook(a, b))',
      output: null, // Can't auto-fix multiple arguments
      errors: [
        {
          messageId: 'arrowFunctionWithoutParams',
          data: {hookName: 'useMyHook'},
        },
      ],
      name: 'Arrow function with no params calling hook with multiple args (no auto-fix)',
    },
    {
      code: `renderHook(() => {
  const x = 1;
  const y = 2;
  return useMyHook(x + y);
})`,
      output: `import {render} from 'sentry-test/reactTestingLibrary';

function MyHook() {
  const x = 1;
  const y = 2;
  return useMyHook(x + y);
}
render(<MyHook />)`,
      errors: [
        {
          messageId: 'useComponentRenderInstead',
        },
      ],
      name: 'Arrow function with multiple statements should convert to component render',
    },
    {
      code: `renderHook(() => {
  const value = 123;
  return useMyHook(value);
})`,
      output: `import {render} from 'sentry-test/reactTestingLibrary';

function MyHook() {
  const value = 123;
  return useMyHook(value);
}
render(<MyHook />)`,
      errors: [
        {
          messageId: 'useComponentRenderInstead',
        },
      ],
      name: 'Arrow function with single variable declaration should convert to component render',
    },
    {
      code: `renderHookWithProviders(() => {
  const state = useState();
  return useMyHook(state);
})`,
      output: `import {render} from 'sentry-test/reactTestingLibrary';

function MyHook() {
  const state = useState();
  return useMyHook(state);
}
render(<MyHook />)`,
      errors: [
        {
          messageId: 'useComponentRenderInstead',
        },
      ],
      name: 'renderHookWithProviders with multiple statements should convert to component render',
    },
    {
      code: `import {screen, userEvent} from 'sentry-test/reactTestingLibrary';

renderHook(() => {
  const value = 123;
  return useMyHook(value);
})`,
      output: `import {screen, userEvent, render} from 'sentry-test/reactTestingLibrary';

function MyHook() {
  const value = 123;
  return useMyHook(value);
}
render(<MyHook />)`,
      errors: [
        {
          messageId: 'useComponentRenderInstead',
        },
      ],
      name: 'Should add render to existing import from sentry-test/reactTestingLibrary',
    },
    {
      code: `import {render} from 'sentry-test/reactTestingLibrary';

renderHook(() => {
  const value = 123;
  return useMyHook(value);
})`,
      output: `import {render} from 'sentry-test/reactTestingLibrary';

function MyHook() {
  const value = 123;
  return useMyHook(value);
}
render(<MyHook />)`,
      errors: [
        {
          messageId: 'useComponentRenderInstead',
        },
      ],
      name: 'Should not duplicate render import if already present',
    },
  ],
});
