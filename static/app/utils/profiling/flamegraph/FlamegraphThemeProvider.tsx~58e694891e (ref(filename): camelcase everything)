import {createContext, useMemo} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import {
  makeColorMapByImage,
  makeColorMapByRecursion,
  makeColorMapBySystemVsApplication,
} from '../colors/utils';

import {
  DarkFlamegraphTheme,
  FlamegraphTheme,
  LightFlamegraphTheme,
} from './flamegraphTheme';
import {useFlamegraphPreferences} from './useFlamegraphPreferences';

export const FlamegraphThemeContext = createContext<FlamegraphTheme | null>(null);

interface FlamegraphThemeProviderProps {
  children: React.ReactNode;
}

function FlamegraphThemeProvider(
  props: FlamegraphThemeProviderProps
): React.ReactElement {
  const {theme} = useLegacyStore(ConfigStore);
  const [flamegraphPreferences] = useFlamegraphPreferences();

  const activeFlamegraphTheme = useMemo((): FlamegraphTheme => {
    const base = theme === 'light' ? LightFlamegraphTheme : DarkFlamegraphTheme;

    switch (flamegraphPreferences.colorCoding) {
      case 'by symbol name': {
        return base;
      }
      case 'by recursion': {
        return {...base, COLORS: {...base.COLORS, COLOR_MAP: makeColorMapByRecursion}};
      }
      case 'by library': {
        return {...base, COLORS: {...base.COLORS, COLOR_MAP: makeColorMapByImage}};
      }
      case 'by system / application': {
        return {
          ...base,
          COLORS: {...base.COLORS, COLOR_MAP: makeColorMapBySystemVsApplication},
        };
      }
      default: {
        throw new TypeError(
          `Unsupported flamegraph color coding ${flamegraphPreferences.colorCoding}`
        );
      }
    }
  }, [theme, flamegraphPreferences.colorCoding]);

  return (
    <FlamegraphThemeContext.Provider value={activeFlamegraphTheme}>
      {props.children}
    </FlamegraphThemeContext.Provider>
  );
}

export {FlamegraphThemeProvider};
