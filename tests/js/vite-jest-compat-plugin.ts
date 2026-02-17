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

// Only process spec/test files
const TEST_FILE_RE = /\.(spec|test)\.[jt]sx?$/;

export default function jestCompatPlugin(): Plugin {
  return {
    name: 'vitest-jest-compat',
    enforce: 'pre',
    transform(code, id) {
      if (!TEST_FILE_RE.test(id)) {
        return undefined;
      }
      // Quick check — skip files with no jest references
      if (!code.includes('jest.')) {
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
