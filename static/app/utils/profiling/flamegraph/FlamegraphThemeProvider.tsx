import * as React from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import {
  DarkFlamegraphTheme,
  FlamegraphTheme,
  LightFlamegraphTheme,
} from './FlamegraphTheme';

export const FlamegraphThemeContext = React.createContext<FlamegraphTheme | null>(null);

interface FlamegraphThemeProviderProps {
  children: React.ReactNode;
}

function FlamegraphThemeProvider(
  props: FlamegraphThemeProviderProps
): React.ReactElement {
  const {theme} = useLegacyStore(ConfigStore);

  return (
    <FlamegraphThemeContext.Provider
      value={theme === 'light' ? LightFlamegraphTheme : DarkFlamegraphTheme}
    >
      {props.children}
    </FlamegraphThemeContext.Provider>
  );
}

export {FlamegraphThemeProvider};
