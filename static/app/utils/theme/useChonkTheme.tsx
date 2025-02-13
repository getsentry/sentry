import {useCallback} from 'react';
import type {Theme} from '@emotion/react';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {removeBodyTheme} from 'sentry/utils/removeBodyTheme';
import {
  DO_NOT_USE_darkChonkTheme,
  DO_NOT_USE_lightChonkTheme,
} from 'sentry/utils/theme/theme.chonk';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';

export function useChonkTheme(): [
  Theme | null,
  (value: 'light' | 'dark' | null) => void,
] {
  const config = useLegacyStore(ConfigStore);
  // @TODO(jonasbadalic): the notion of an organization should be removed from the config store
  // before release, as we may not always have an organization. When we release, chonk should
  // be the value that we receive from the server config - the theme should ultimately be toggled there
  const {organization} = useLegacyStore(OrganizationStore);

  const [chonkTheme, setChonkTheme] = useSessionStorage<'light' | 'dark' | null>(
    'chonk-theme',
    null
  );

  let theme = null;

  // Check feature access and if chonk theme is enabled
  if (organization?.features?.includes('chonk-ui') && chonkTheme) {
    theme =
      config.theme === 'dark' ? DO_NOT_USE_darkChonkTheme : DO_NOT_USE_lightChonkTheme;
  }

  const setChonkWithSideEffect = useCallback(
    (value: 'light' | 'dark' | null) => {
      removeBodyTheme();
      setChonkTheme(value);
    },
    [setChonkTheme]
  );

  return [theme, setChonkWithSideEffect];
}
