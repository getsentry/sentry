import {createContext, useCallback, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import {useSelector} from '@tanstack/react-store';
import cloneDeep from 'lodash/cloneDeep';

import {ConfigStore} from 'sentry/stores/configStore';
import type {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {
  makeDarkFlamegraphTheme,
  makeLightFlamegraphTheme,
} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';

export const FlamegraphThemeContext = createContext<FlamegraphTheme | null>(null);

type FlamegraphThemeMutationCallback = (
  theme: FlamegraphTheme,
  colorMode?: 'light' | 'dark'
) => FlamegraphTheme;

const FlamegraphThemeMutationContext = createContext<
  ((cb: FlamegraphThemeMutationCallback) => void) | null
>(null);

interface FlamegraphThemeProviderProps {
  children: React.ReactNode;
}

function FlamegraphThemeProvider(
  props: FlamegraphThemeProviderProps
): React.ReactElement {
  const theme = useTheme();
  const colorMode = useSelector(ConfigStore.store, state => state.theme);
  const [mutation, setMutation] = useState<FlamegraphThemeMutationCallback | null>(null);

  const addModifier = useCallback((cb: FlamegraphThemeMutationCallback) => {
    setMutation(() => cb);
  }, []);

  const activeFlamegraphTheme = useMemo(() => {
    const flamegraphTheme =
      colorMode === 'light'
        ? makeLightFlamegraphTheme(theme)
        : makeDarkFlamegraphTheme(theme);

    if (!mutation) {
      return flamegraphTheme;
    }
    const clonedTheme = cloneDeep(flamegraphTheme);
    return mutation(clonedTheme, colorMode);
  }, [mutation, colorMode, theme]);

  return (
    <FlamegraphThemeMutationContext value={addModifier}>
      <FlamegraphThemeContext value={activeFlamegraphTheme}>
        {props.children}
      </FlamegraphThemeContext>
    </FlamegraphThemeMutationContext>
  );
}

export {FlamegraphThemeProvider};
