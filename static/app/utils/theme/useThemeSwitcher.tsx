import {useMemo} from 'react';
import type {DO_NOT_USE_ChonkTheme, Theme} from '@emotion/react';

import {addMessage} from 'sentry/actionCreators/indicator';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {User} from 'sentry/types/user';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
// eslint-disable-next-line no-restricted-imports -- @TODO(jonasbadalic): Remove theme import
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {
  DO_NOT_USE_darkChonkTheme,
  DO_NOT_USE_lightChonkTheme,
} from 'sentry/utils/theme/theme.chonk';
import {useHotkeys} from 'sentry/utils/useHotkeys';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import {useUser} from 'sentry/utils/useUser';

export function useThemeSwitcher(): DO_NOT_USE_ChonkTheme | Theme {
  const config = useLegacyStore(ConfigStore);
  // User can be nullable in some cases where this hook can be called, however the
  // type of the user is not nullable, so we will cast it to undefined.
  const user = useUser() as User | undefined;
  // @TODO(jonasbadalic): the notion of an organization should be removed from the config store
  // before release, as we may not always have an organization. When we release, chonk should
  // be the value that we receive from the server config - the theme should ultimately be toggled there
  const {organization} = useLegacyStore(OrganizationStore);

  const {mutate: mutateUserOptions} = useMutateUserOptions();

  let theme: Theme | DO_NOT_USE_ChonkTheme =
    config.theme === 'dark' ? darkTheme : lightTheme;

  if (
    organization?.features.includes('chonk-ui-enforce') ||
    (organization?.features?.includes('chonk-ui') && user?.options?.prefersChonkUI)
  ) {
    theme =
      config.theme === 'dark' ? DO_NOT_USE_darkChonkTheme : DO_NOT_USE_lightChonkTheme;
  }

  // Hotkey definition for toggling the current theme
  const themeToggleHotkey = useMemo(
    () => ({
      match: ['command+shift+1', 'ctrl+shift+1'],
      includeInputs: true,
      callback: () => {
        removeBodyTheme();
        ConfigStore.set('theme', config.theme === 'dark' ? 'light' : 'dark');
      },
    }),
    [config.theme]
  );

  // Hotkey definition for toggling the chonk theme
  const chonkThemeToggleHotkey = useMemo(
    () => ({
      match: ['command+shift+2', 'ctrl+shift+2'],
      includeInputs: true,
      callback: () => {
        if (user?.options?.prefersChonkUI) {
          ConfigStore.set('theme', config.theme);
          addMessage(`Using default theme`, 'success');
          mutateUserOptions({prefersChonkUI: false});
        } else {
          addMessage(`Previewing new theme`, 'success');
          mutateUserOptions({prefersChonkUI: true});
        }
      },
    }),
    [user?.options?.prefersChonkUI, config.theme, mutateUserOptions]
  );

  useHotkeys(
    organization?.features?.includes('chonk-ui')
      ? [themeToggleHotkey, chonkThemeToggleHotkey]
      : [themeToggleHotkey]
  );
  return theme;
}
