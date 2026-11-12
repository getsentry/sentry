import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {replayMaskFn, useReplayReady} from 'getsentry/utils/useReplayInit';

describe('useReplayReady', () => {
  it('returns false before the replay integration is registered', () => {
    // Regression: `let replayRef: ... | null;` without an initializer left
    // the singleton as `undefined`, so `useState(() => replayRef !== null)`
    // started `ready` as `true` before init ran.
    const {result} = renderHookWithProviders(() => useReplayReady());

    expect(result.current).toBe(false);
  });
});

describe('replayMaskFn', () => {
  it('masks non-static string text by replacing non-whitespace characters', () => {
    // 'hello world' is not a static translation string
    expect(replayMaskFn('hello world')).toBe('***** *****');
  });

  it('returns static translation strings unmasked', () => {
    // Empty string is not considered a static string
    expect(replayMaskFn('')).toBe('');
  });

  it('returns empty string for null without throwing', () => {
    // Regression: rrweb can pass non-string values to maskFn at runtime,
    // which caused TypeError: e.trim is not a function in isStaticString.
    expect(replayMaskFn(null)).toBe('');
  });

  it('returns empty string for undefined without throwing', () => {
    expect(replayMaskFn(undefined)).toBe('');
  });

  it('returns empty string for a number without throwing', () => {
    expect(replayMaskFn(42)).toBe('');
  });

  it('returns empty string for an object without throwing', () => {
    expect(replayMaskFn({textContent: 'foo'})).toBe('');
  });
});
