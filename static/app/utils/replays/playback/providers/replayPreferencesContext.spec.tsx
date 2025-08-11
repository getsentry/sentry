import type {ReactNode} from 'react';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {
  LocalStorageReplayPreferences,
  type PrefsStrategy,
  StaticReplayPreferences,
} from 'sentry/components/replays/preferences/replayPreferences';
import {
  ReplayPreferencesContextProvider,
  useReplayPrefs,
} from 'sentry/utils/replays/playback/providers/replayPreferencesContext';

function makeWrapper(prefsStrategy: PrefsStrategy) {
  return function ({children}: {children?: ReactNode}) {
    return (
      <ReplayPreferencesContextProvider prefsStrategy={prefsStrategy}>
        {children}
      </ReplayPreferencesContextProvider>
    );
  };
}

describe('replayPlayerPluginsContext', () => {
  it('should have a stable reference to a function that returns a list of plugins', () => {
    const prefsStrategy = LocalStorageReplayPreferences;
    const {result, rerender} = renderHook(useReplayPrefs, {
      wrapper: makeWrapper(prefsStrategy),
    });

    const initialRef = result.current;

    rerender();

    expect(result.current).toEqual(initialRef);
  });

  it('should return the static strategy if there is no provider', () => {
    const {result} = renderHook(useReplayPrefs);

    expect(result.current).toEqual([StaticReplayPreferences.get(), expect.any(Function)]);
  });

  it('should allow setting updates to the state', () => {
    const prefsStrategy = LocalStorageReplayPreferences;
    const {result, rerender} = renderHook(useReplayPrefs, {
      wrapper: makeWrapper(prefsStrategy),
    });

    expect(result.current).toEqual([
      {isSkippingInactive: true, playbackSpeed: 1, timestampType: 'relative'},
      expect.any(Function),
    ]);

    act(() => {
      const [, setState] = result.current;
      setState({playbackSpeed: 22});
    });

    rerender();

    expect(result.current).toEqual([
      expect.objectContaining({playbackSpeed: 22}),
      expect.any(Function),
    ]);
  });
});
