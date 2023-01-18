import {createContext, useMemo} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {
  makeColorMapByApplicationFrame,
  makeColorMapByFrequency,
  makeColorMapByLibrary,
  makeColorMapByRecursion,
  makeColorMapBySystemFrame,
} from 'sentry/utils/profiling/colors/utils';
import {
  DarkFlamegraphTheme,
  FlamegraphTheme,
  LightFlamegraphTheme,
} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';

export const FlamegraphThemeContext = createContext<FlamegraphTheme | null>(null);

interface FlamegraphThemeProviderProps {
  children: React.ReactNode;
}

function FlamegraphThemeProvider(
  props: FlamegraphThemeProviderProps
): React.ReactElement {
  const {theme} = useLegacyStore(ConfigStore);
  const flamegraphPreferences = useFlamegraphPreferences();

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
        return {...base, COLORS: {...base.COLORS, COLOR_MAP: makeColorMapByLibrary}};
      }
      case 'by system frame': {
        return {
          ...base,
          COLORS: {...base.COLORS, COLOR_MAP: makeColorMapBySystemFrame},
        };
      }
      case 'by application frame': {
        return {
          ...base,
          COLORS: {...base.COLORS, COLOR_MAP: makeColorMapByApplicationFrame},
        };
      }
      case 'by frequency': {
        return {
          ...base,
          COLORS: {...base.COLORS, COLOR_MAP: makeColorMapByFrequency},
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
