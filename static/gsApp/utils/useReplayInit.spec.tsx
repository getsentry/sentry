import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useReplayInit} from 'getsentry/utils/useReplayInit';

describe('useReplayInit', () => {
  it('returns false before the replay integration is registered', () => {
    // Regression: `let replayRef: ... | null;` without an initializer left
    // the singleton as `undefined`, so `useState(() => replayRef !== null)`
    // started `ready` as `true` before init ran.
    const {result} = renderHookWithProviders(() => useReplayInit());

    expect(result.current).toBe(false);
  });
});
