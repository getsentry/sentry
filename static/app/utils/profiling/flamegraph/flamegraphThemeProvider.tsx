import {createContext} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {
  DarkFlamegraphTheme,
  FlamegraphTheme,
  LightFlamegraphTheme,
} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';

export const FlamegraphThemeContext = createContext<FlamegraphTheme | null>(null);

interface FlamegraphThemeProviderProps {
  children: React.ReactNode;
}

function FlamegraphThemeProvider(
  props: FlamegraphThemeProviderProps
): React.ReactElement {
  const {theme} = useLegacyStore(ConfigStore);

  const activeFlamegraphTheme =
    theme === 'light' ? LightFlamegraphTheme : DarkFlamegraphTheme;

  return (
    <FlamegraphThemeContext.Provider value={activeFlamegraphTheme}>
      {props.children}
    </FlamegraphThemeContext.Provider>
  );
}

export {FlamegraphThemeProvider};
