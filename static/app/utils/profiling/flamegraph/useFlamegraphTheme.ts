import {useContext, useMemo} from 'react';

import {
  makeColorMapByApplicationFrame,
  makeColorMapByFrequency,
  makeColorMapByLibrary,
  makeColorMapByRecursion,
  makeColorMapBySystemFrame,
} from 'sentry/utils/profiling/colors/utils';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';

import {FlamegraphTheme} from './flamegraphTheme';
import {FlamegraphThemeContext} from './flamegraphThemeProvider';

export function useFlamegraphThemeWithoutPreferences(): FlamegraphTheme {
  const ctx = useContext(FlamegraphThemeContext);

  if (!ctx) {
    throw new Error('useFlamegraphTheme was called outside of FlamegraphThemeProvider');
  }

  return ctx;
}

export function useFlamegraphThemeWithPreferences(): FlamegraphTheme {
  const baseTheme = useFlamegraphThemeWithoutPreferences();
  const {colorCoding} = useFlamegraphPreferences();

  const activeFlamegraphTheme = useMemo(() => {
    switch (colorCoding) {
      case 'by symbol name': {
        return baseTheme;
      }
      case 'by recursion': {
        return {
          ...baseTheme,
          COLORS: {...baseTheme.COLORS, COLOR_MAP: makeColorMapByRecursion},
        };
      }
      case 'by library': {
        return {
          ...baseTheme,
          COLORS: {...baseTheme.COLORS, COLOR_MAP: makeColorMapByLibrary},
        };
      }
      case 'by system frame': {
        return {
          ...baseTheme,
          COLORS: {...baseTheme.COLORS, COLOR_MAP: makeColorMapBySystemFrame},
        };
      }
      case 'by application frame': {
        return {
          ...baseTheme,
          COLORS: {...baseTheme.COLORS, COLOR_MAP: makeColorMapByApplicationFrame},
        };
      }
      case 'by frequency': {
        return {
          ...baseTheme,
          COLORS: {...baseTheme.COLORS, COLOR_MAP: makeColorMapByFrequency},
        };
      }
      default: {
        throw new TypeError(`Unsupported flamegraph color coding ${colorCoding}`);
      }
    }
  }, [colorCoding, baseTheme]);

  return activeFlamegraphTheme;
}
