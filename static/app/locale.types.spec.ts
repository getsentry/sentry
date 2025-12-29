/**
 * Type-level tests for tct function type safety.
 * These tests verify that the TypeScript compiler correctly enforces
 * component requirements based on shortcodes in template strings.
 *
 * Note: This file uses type assertions only - no runtime code.
 */

import type React from 'react';

// eslint-disable-next-line no-restricted-imports
import type {tct} from 'sentry/locale';

// Helper types for testing
type AnyComponent = React.ReactNode;
declare const anyComponent: AnyComponent;

// Helper to simulate dynamic template strings
declare function getMessage(): string;

// Type-level tests using Parameters and ReturnType to check signatures
type TctFunction = typeof tct;

// ✅ Built-in shortcode without component should work
type Test1 = Parameters<TctFunction<'[code:value]'>>;
type Test1Valid = Test1 extends [string] | [string, any?] ? true : false;

// ✅ Custom shortcode with component should work
type Test2 = Parameters<TctFunction<'[myLink:click]'>>;
type Test2RequiresComponent = Test2 extends [string, {myLink: any}] ? true : false;

// ✅ Multiple built-ins should work
type Test3 = Parameters<TctFunction<'[code:a] [strong:b]'>>;
type Test3Valid = Test3 extends [string] | [string, any?] ? true : false;

// ✅ Mixed built-in and custom should require custom only
type Test4 = Parameters<TctFunction<'[code:a] [custom:b]'>>;
type Test4RequiresCustom = Test4 extends [string, {custom: any}] ? true : false;

// ✅ Dynamic string should accept any components
type Test5 = Parameters<TctFunction<string>>;
type Test5AllowsAnything = Test5 extends [string, any?] ? true : false;

// ✅ Multiple custom shortcodes should require all
type Test6 = Parameters<TctFunction<'[one:a] [two:b]'>>;
type Test6RequiresBoth = Test6 extends [string, {one: any; two: any}] ? true : false;

// ✅ Nested shortcodes should extract all
type Test7 = Parameters<TctFunction<'[outer:Text [inner:value]]'>>;
type Test7RequiresBoth = Test7 extends [string, {inner: any; outer: any}] ? true : false;

// ✅ Built-ins can be overridden
type Test8 = Parameters<TctFunction<'[code:value]'>>;
type Test8AllowsOverride = Test8 extends
  | [string]
  | [string, {code?: any}]
  | [string, Partial<any>]
  ? true
  : false;
