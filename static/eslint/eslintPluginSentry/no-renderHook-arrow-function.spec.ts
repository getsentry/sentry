import {RuleTester} from 'eslint';

import noRenderHookArrowFunction from './no-renderHook-arrow-function.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
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
      name: 'Arrow function with no parameters calling hook with no args',
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
      name: 'Arrow function with no parameters calling hook with static args',
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
      output: 'renderHook(useMyHook, {initialProps: [foo, bar]})',
      errors: [
        {
          messageId: 'unnecessaryArrowFunction',
          data: {hookName: 'useMyHook', props: 'foo, bar'},
        },
      ],
      name: 'Arrow function with unused parameter and multiple hook args',
    },
  ],
});
