import {useLayoutEffect, useMemo} from 'react';
import type {DO_NOT_USE_ChonkTheme, Theme} from '@emotion/react';

import {addMessage} from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
// eslint-disable-next-line no-restricted-imports -- @TODO(jonasbadalic): Remove theme import
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {
  DO_NOT_USE_darkChonkTheme,
  DO_NOT_USE_lightChonkTheme,
} from 'sentry/utils/theme/theme.chonk';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import usePrevious from 'sentry/utils/usePrevious';

export function useThemeSwitcher(): DO_NOT_USE_ChonkTheme | Theme {
  const config = useLegacyStore(ConfigStore);
  // @TODO(jonasbadalic): the notion of an organization should be removed from the config store
  // before release, as we may not always have an organization. When we release, chonk should
  // be the value that we receive from the server config - the theme should ultimately be toggled there
  const {organization} = useLegacyStore(OrganizationStore);
  const [chonkTheme, setChonkTheme] = useLocalStorageState<{
    theme: 'light' | 'dark' | null;
  }>('chonk-theme', {theme: null});

  let theme = config.theme === 'dark' ? darkTheme : lightTheme;
  // Check feature access and if chonk theme is enabled
  if (organization?.features?.includes('chonk-ui') && chonkTheme.theme) {
    theme =
      chonkTheme.theme === 'dark'
        ? DO_NOT_USE_darkChonkTheme
        : DO_NOT_USE_lightChonkTheme;
  }

  // Only fire if the config theme changes or the organization does not have chonk-ui feature.
  // In practice, this should be the only place where the theme could be changed, so this is
  // likely redundant, but it gives us some extra safety and ensures we react to changes in the store
  const previousTheme = usePrevious(config.theme);
  useLayoutEffect(() => {
    if (
      previousTheme !== config.theme ||
      (organization && !organization?.features?.includes('chonk-ui'))
    ) {
      removeBodyTheme();
      setChonkTheme({theme: null});
    }
  }, [config.theme, organization, previousTheme, setChonkTheme]);

  // Hotkey definition for toggling the current theme
  const currentThemeHotkey = useMemo(
    () => ({
      match: ['command+shift+1', 'ctrl+shift+1'],
      includeInputs: true,
      callback: () => {
        removeBodyTheme();
        if (chonkTheme.theme) {
          addMessage(`Using default theme`, 'success');
        }
        ConfigStore.set(
          'theme',
          chonkTheme.theme === null
            ? config.theme === 'dark'
              ? 'light'
              : 'dark'
            : chonkTheme.theme === 'dark'
              ? 'dark'
              : 'light'
        );
        setChonkTheme({theme: null});
      },
    }),
    [chonkTheme.theme, config.theme, setChonkTheme]
  );

  // Hotkey definition for toggling the chonk theme
  const chonkThemeHotkey = useMemo(
    () => ({
      match: ['command+shift+2', 'ctrl+shift+2'],
      includeInputs: true,
      callback: () => {
        removeBodyTheme();
        if (!chonkTheme.theme) {
          addMessage(`Previewing new theme`, 'success');
        }
        setChonkTheme({
          theme:
            // A bit of extra logic to ensure that toggling from chonk to legacy and
            // vice versa persists the current theme. This makes it easier to look for UI
            // changes as we can quickly swap between light or dark themes.
            chonkTheme.theme === null
              ? config.theme === 'dark'
                ? 'dark'
                : 'light'
              : chonkTheme.theme === 'dark'
                ? 'light'
                : 'dark',
        });
      },
    }),
    [chonkTheme.theme, config.theme, setChonkTheme]
  );

  const themeToggleHotkeys = useMemo(() => {
    return organization?.features?.includes('chonk-ui')
      ? [currentThemeHotkey, chonkThemeHotkey]
      : [currentThemeHotkey];
  }, [organization, chonkThemeHotkey, currentThemeHotkey]);

  useHotkeys(themeToggleHotkeys);
  return theme;
}
