import {createContext, useCallback, useMemo, useState} from 'react';
import cloneDeep from 'lodash/cloneDeep';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {
  DarkFlamegraphTheme,
  FlamegraphTheme,
  LightFlamegraphTheme,
} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';

export const FlamegraphThemeContext = createContext<FlamegraphTheme | null>(null);

type FlamegraphThemeMutationCallback = (
  theme: FlamegraphTheme,
  colorMode?: 'light' | 'dark'
) => FlamegraphTheme;

export const FlamegraphThemeMutationContext = createContext<
  ((cb: FlamegraphThemeMutationCallback) => void) | null
>(null);

interface FlamegraphThemeProviderProps {
  children: React.ReactNode;
}

function FlamegraphThemeProvider(
  props: FlamegraphThemeProviderProps
): React.ReactElement {
  const {theme: colorMode} = useLegacyStore(ConfigStore);

  const [mutation, setMutation] = useState<FlamegraphThemeMutationCallback | null>(null);

  const addModifier = useCallback((cb: FlamegraphThemeMutationCallback) => {
    setMutation(() => cb);
  }, []);

  const activeFlamegraphTheme = useMemo(() => {
    const flamegraphTheme =
      colorMode === 'light' ? LightFlamegraphTheme : DarkFlamegraphTheme;
    if (!mutation) {
      return flamegraphTheme;
    }
    const clonedTheme = cloneDeep(flamegraphTheme);
    return mutation(clonedTheme, colorMode);
  }, [mutation, colorMode]);

  return (
    <FlamegraphThemeMutationContext.Provider value={addModifier}>
      <FlamegraphThemeContext.Provider value={activeFlamegraphTheme}>
        {props.children}
      </FlamegraphThemeContext.Provider>
    </FlamegraphThemeMutationContext.Provider>
  );
}

export {FlamegraphThemeProvider};
