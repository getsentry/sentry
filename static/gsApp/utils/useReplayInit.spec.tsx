import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {useReplayReady} from 'getsentry/utils/useReplayInit';

describe('useReplayReady', () => {
  it('returns false before the replay integration is registered', () => {
    // Regression: `let replayRef: ... | null;` without an initializer left
    // the singleton as `undefined`, so `useState(() => replayRef !== null)`
    // started `ready` as `true` before init ran.
    const {result} = renderHookWithProviders(() => useReplayReady());

    expect(result.current).toBe(false);
  });
});
