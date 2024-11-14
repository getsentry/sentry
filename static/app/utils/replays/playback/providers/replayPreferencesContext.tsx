import {createContext, useCallback, useContext, useState} from 'react';

import type {
  PrefsStrategy,
  ReplayPrefs,
} from 'sentry/components/replays/preferences/replayPreferences';
import {StaticReplayPreferences} from 'sentry/components/replays/preferences/replayPreferences';

type ContextType = [ReplayPrefs, (prefs: Partial<ReplayPrefs>) => void];

const StateContext = createContext<ContextType>([
  StaticReplayPreferences.get(),
  () => {},
]);

export function ReplayPreferencesContextProvider({
  children,
  prefsStrategy,
}: {
  children: React.ReactNode;
  prefsStrategy: PrefsStrategy;
}) {
  const [state, setState] = useState<ReplayPrefs>(() => prefsStrategy.get());

  const setPrefs = useCallback(
    (config: Partial<ReplayPrefs>) => {
      const updated = {
        ...prefsStrategy.get(),
        ...config,
      };
      prefsStrategy.set(updated);
      setState(updated);
    },
    [prefsStrategy]
  );

  return (
    <StateContext.Provider value={[state, setPrefs]}>{children}</StateContext.Provider>
  );
}

export function useReplayPrefs() {
  return useContext(StateContext);
}
