import {useCallback, useLayoutEffect, useMemo} from 'react';
import type {DO_NOT_USE_ChonkTheme} from '@emotion/react';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
import {
  DO_NOT_USE_darkChonkTheme,
  DO_NOT_USE_lightChonkTheme,
} from 'sentry/utils/theme/theme.chonk';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import usePrevious from 'sentry/utils/usePrevious';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

export function useChonkThemeSwitcher(): [
  DO_NOT_USE_ChonkTheme | null,
  (value: 'light' | 'dark' | null) => void,
] {
  const config = useLegacyStore(ConfigStore);
  // @TODO(jonasbadalic): the notion of an organization should be removed from the config store
  // before release, as we may not always have an organization. When we release, chonk should
  // be the value that we receive from the server config - the theme should ultimately be toggled there
  const {organization} = useLegacyStore(OrganizationStore);
  const [chonkTheme, setChonkTheme] = useSessionStorage<{theme: 'light' | 'dark' | null}>(
    'chonk-theme',
    {theme: null}
  );

  let theme = null;
  // Check feature access and if chonk theme is enabled
  if (organization?.features?.includes('chonk-ui') && chonkTheme.theme) {
    theme =
      chonkTheme.theme === 'dark'
        ? DO_NOT_USE_darkChonkTheme
        : DO_NOT_USE_lightChonkTheme;
  }

  const setChonkWithSideEffect = useCallback(
    (value: 'light' | 'dark' | null) => {
      removeBodyTheme();
      setChonkTheme({theme: value});
    },
    [setChonkTheme]
  );

  // Only fire if the config theme changes
  const previousTheme = usePrevious(config.theme);
  useLayoutEffect(() => {
    if (previousTheme !== config.theme || !organization?.features?.includes('chonk-ui')) {
      removeBodyTheme();
      setChonkTheme({theme: null});
    }
  }, [config.theme, organization, previousTheme, setChonkTheme]);

  const chonkToggleHotkeys = useMemo(() => {
    return organization?.features?.includes('chonk-ui')
      ? [
          {
            match: ['command+shift+2', 'ctrl+shift+2'],
            includeInputs: true,
            callback: () => {
              setChonkWithSideEffect(chonkTheme.theme === 'dark' ? 'light' : 'dark');
            },
          },
        ]
      : [];
  }, [organization, chonkTheme.theme, setChonkWithSideEffect]);

  useHotkeys(chonkToggleHotkeys);

  return [theme, setChonkWithSideEffect];
}
