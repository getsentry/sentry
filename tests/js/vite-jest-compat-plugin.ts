// eslint-disable-next-line import/no-extraneous-dependencies
import type {Plugin} from 'vite';

/**
 * Vite plugin that rewrites `jest.*` calls to `vi.*` in test files at
 * compile time. This is necessary because Vitest's compiler hoists
 * `vi.mock()` / `vi.unmock()` calls to the top of the module, but it can
 * only detect them when written as `vi.mock(...)`. Tests that still use
 * `jest.mock(...)` (the majority during migration) would not be hoisted
 * and the mocks would apply too late.
 *
 * By doing the replacement at the Vite transform level, Vitest sees
 * `vi.mock(...)` in the transformed source and hoists it correctly.
 *
 * Additionally handles `jest.requireActual` → `await vi.importActual`
 * and makes vi.mock factory callbacks async when they contain await.
 *
 * Also fixes two Vitest v4 incompatibilities that apply to both migrated
 * and hand-written vi.* code:
 *
 * 1. Arrow functions in vi.fn() implementations — Vitest v4 calls
 *    `Reflect.construct(implementation, args, new.target)` when a mock is
 *    used as a constructor. Arrow functions are not constructable, so this
 *    throws. Block-body arrow implementations are rewritten to regular
 *    functions so they work both as constructors and as plain functions.
 *
 * 2. vi.importActual() without await — vi.importActual() is async and must
 *    be awaited. Bare calls are rewritten to `await vi.importActual()` and
 *    the containing vi.mock factory is made async automatically.
 */

const JEST_TO_VI: Array<[RegExp, string]> = [
  // jest.mock / jest.unmock / jest.doMock / jest.doUnmock
  [/\bjest\.mock\b/g, 'vi.mock'],
  [/\bjest\.unmock\b/g, 'vi.unmock'],
  [/\bjest\.doMock\b/g, 'vi.doMock'],
  [/\bjest\.doUnmock\b/g, 'vi.doUnmock'],

  // jest.fn / jest.spyOn / jest.mocked
  [/\bjest\.fn\b/g, 'vi.fn'],
  [/\bjest\.spyOn\b/g, 'vi.spyOn'],
  [/\bjest\.mocked\b/g, 'vi.mocked'],

  // jest.requireActual / jest.requireMock are handled separately below
  // (they need parens wrapping for correct operator precedence)

  // Timer mocks
  [/\bjest\.useFakeTimers\b/g, 'vi.useFakeTimers'],
  [/\bjest\.useRealTimers\b/g, 'vi.useRealTimers'],
  [/\bjest\.runAllTimers\b/g, 'vi.runAllTimers'],
  [/\bjest\.runOnlyPendingTimers\b/g, 'vi.runOnlyPendingTimers'],
  [/\bjest\.advanceTimersByTime\b/g, 'vi.advanceTimersByTime'],
  [/\bjest\.advanceTimersToNextTimer\b/g, 'vi.advanceTimersToNextTimer'],
  [/\bjest\.clearAllTimers\b/g, 'vi.clearAllTimers'],
  [/\bjest\.getTimerCount\b/g, 'vi.getTimerCount'],
  [/\bjest\.setSystemTime\b/g, 'vi.setSystemTime'],
  [/\bjest\.getRealSystemTime\b/g, 'vi.getRealSystemTime'],

  // Mock management
  [/\bjest\.clearAllMocks\b/g, 'vi.clearAllMocks'],
  [/\bjest\.resetAllMocks\b/g, 'vi.resetAllMocks'],
  [/\bjest\.restoreAllMocks\b/g, 'vi.restoreAllMocks'],
  [/\bjest\.resetModules\b/g, 'vi.resetModules'],

  // Misc
  [/\bjest\.isMockFunction\b/g, 'vi.isMockFunction'],
  [/\bjest\.stubGlobal\b/g, 'vi.stubGlobal'],
];

// Only process spec/test files and Vitest setup.
const TEST_FILE_RE = /\.(spec|test)\.[jt]sx?$/;
const VITEST_SETUP_RE = /\/tests\/js\/vitest-setup\.ts$/;

export default function jestCompatPlugin(): Plugin {
  return {
    name: 'vitest-jest-compat',
    enforce: 'pre',
    transform(code, id) {
      if (!TEST_FILE_RE.test(id) && !VITEST_SETUP_RE.test(id)) {
        return undefined;
      }
      // Quick check — skip files with nothing to transform
      if (
        !code.includes('jest.') &&
        !code.includes('vi.importActual(') &&
        !code.includes('vi.fn(() =>') &&
        !code.includes('vi.mock(')
      ) {
        return undefined;
      }

      let transformed = code;
      for (const [pattern, replacement] of JEST_TO_VI) {
        transformed = transformed.replace(pattern, replacement);
      }

      // Handle jest.requireActual('module') → (await vi.importActual('module'))
      // Wrapping in parens ensures correct precedence for property access:
      //   jest.requireActual('mod').Prop → (await vi.importActual('mod')).Prop
      transformed = transformed.replace(
        /\bjest\.requireActual\(([^)]+)\)/g,
        '(await vi.importActual($1))'
      );

      // Handle jest.requireMock('module') → (await import('module'))
      // In Vitest, vi.mock is hoisted, so a dynamic import() will resolve
      // to the mocked version. vi.importMock does not exist.
      transformed = transformed.replace(
        /\bjest\.requireMock\(([^)]+)\)/g,
        '(await import($1))'
      );

      // Rewrite block-body arrow function implementations in vi.fn() calls to
      // regular functions. Vitest v4 uses Reflect.construct(implementation, ...)
      // when a mock is called with `new`, and arrow functions are not
      // constructable. Regular functions work in both constructor and call
      // contexts so this is always safe.
      // Handles params without nested parens (e.g. typed callbacks like
      // `callback: () => void` contain a `)` and are left as-is; they produce
      // a Vitest warning but don't silently break).
      transformed = transformed.replace(
        /\bvi\.fn\(\s*\(([^)]*)\)\s*=>\s*\{/g,
        (_, params) => `vi.fn(function (${params}) {`
      );
      transformed = transformed.replace(
        /\bvi\.fn\(\s*\(\s*\)\s*=>\s*([A-Za-z_$][\w$.]*)\s*\)/g,
        (_, expression) => `vi.fn(function () { return ${expression}; })`
      );
      transformed = transformed.replace(
        /\bvi\.fn\(\s*\(\s*\)\s*=>\s*\(\s*(\{(?:[^{}]|\{[^{}]*\})*\})\s*\)\s*\)/g,
        (_, objectLiteral) => `vi.fn(function () { return (${objectLiteral}); })`
      );
      transformed = transformed.replace(
        /\.mockImplementation(Once)?\(\s*\(([^)]*)\)\s*=>\s*\{/g,
        (_match, once, params) =>
          `.mockImplementation${once ?? ''}(function (${params}) {`
      );
      transformed = transformed.replace(
        /\.mockImplementation(Once)?\(\s*\(\s*\)\s*=>\s*([A-Za-z_$][\w$.]*)\s*\)/g,
        (_match, once, expression) =>
          `.mockImplementation${once ?? ''}(function () { return ${expression}; })`
      );
      transformed = transformed.replace(
        /\.mockImplementation(Once)?\(\s*\(\s*\)\s*=>\s*\(\s*(\{(?:[^{}]|\{[^{}]*\})*\})\s*\)\s*\)/g,
        (_match, once, objectLiteral) =>
          `.mockImplementation${once ?? ''}(function () { return (${objectLiteral}); })`
      );

      // Vitest ESM mocks for static assets must return `{default: ...}`.
      transformed = transformed.replace(
        /vi\.mock\(\s*(['"][^'"]+\.(?:svg|png|jpe?g|gif|webp)['"])\s*,\s*\(\)\s*=>\s*(['"][^'"]*['"])\s*,\s*(\{\s*\})\s*\)/g,
        'vi.mock($1, () => ({default: $2}), $3)'
      );
      transformed = transformed.replace(
        /vi\.mock\(\s*(['"][^'"]+\.(?:svg|png|jpe?g|gif|webp)['"])\s*,\s*\(\)\s*=>\s*(['"][^'"]*['"])\s*\)/g,
        'vi.mock($1, () => ({default: $2}))'
      );
      transformed = transformed.replace(
        /vi\.mock\(\s*(['"][^'"]+['"])\s*,\s*\(\)\s*=>\s*(['"][^'"]*['"])\s*,\s*(\{\s*\})\s*\)/g,
        'vi.mock($1, () => ({default: $2}), $3)'
      );
      transformed = transformed.replace(
        /vi\.mock\(\s*(['"][^'"]+['"])\s*,\s*\(\)\s*=>\s*(['"][^'"]*['"])\s*\)/g,
        'vi.mock($1, () => ({default: $2}))'
      );
      transformed = transformed.replace(
        /vi\.mock\(\s*(['"][^'"]+['"])\s*,\s*\(\)\s*=>\s*\{\s*\}\s*,\s*(\{\s*\})\s*\)/g,
        'vi.mock($1, () => ({}), $2)'
      );
      transformed = transformed.replace(
        /vi\.mock\(\s*(['"][^'"]+['"])\s*,\s*\(\)\s*=>\s*\{\s*\}\s*\)/g,
        'vi.mock($1, () => ({}))'
      );
      transformed = transformed.replace(
        /vi\.mock\(\s*(['"][^'"]+['"])\s*,\s*\(\)\s*=>\s*\{\s*return\s+((?!\{)[^;]+);\s*\}\s*,\s*(\{\s*\})\s*\)/g,
        'vi.mock($1, () => ({default: $2}), $3)'
      );
      transformed = transformed.replace(
        /vi\.mock\(\s*(['"][^'"]+['"])\s*,\s*\(\)\s*=>\s*\{\s*return\s+((?!\{)[^;]+);\s*\}\s*\)/g,
        'vi.mock($1, () => ({default: $2}))'
      );
      transformed = transformed.replace(
        /vi\.mock\(\s*['"]lodash\/debounce['"]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)return\s+([^;]+);\s*\}\s*\)/g,
        (_match, prefix, returnExpr) =>
          `vi.mock('lodash/debounce', () => {${prefix}return {default: ${returnExpr}};})`
      );

      // Ensure vi.importActual() is always awaited. Uses a callback rather
      // than a lookbehind assertion for broad engine compatibility.
      transformed = transformed.replace(/\bvi\.importActual\(/g, (match, offset, str) => {
        const before = str.slice(Math.max(0, offset - 6), offset);
        return /await\s*$/.test(before) ? match : 'await vi.importActual(';
      });

      // If we introduced `await vi.importActual` or `await import` inside
      // vi.mock factories, make those factories async so the await is valid.
      // Matches: vi.mock('...', () => {  →  vi.mock('...', async () => {
      // Also:   vi.mock('...', function() {  →  vi.mock('...', async function() {
      if (
        transformed.includes('await vi.importActual') ||
        transformed.includes('await import(')
      ) {
        transformed = transformed.replace(
          /vi\.mock\(([^,]+),\s*\(\)\s*=>\s*\{/g,
          'vi.mock($1, async () => {'
        );
        transformed = transformed.replace(
          /vi\.mock\(([^,]+),\s*\(\)\s*=>\s*\(/g,
          'vi.mock($1, async () => ('
        );
        transformed = transformed.replace(
          /vi\.mock\(([^,]+),\s*function\s*\(\)\s*\{/g,
          'vi.mock($1, async function() {'
        );
      }

      if (transformed === code) {
        return undefined;
      }

      return {code: transformed, map: null};
    },
  };
}
