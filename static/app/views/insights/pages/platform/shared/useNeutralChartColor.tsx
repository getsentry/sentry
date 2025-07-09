import {useTheme} from '@emotion/react';
import Color from 'color';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export function useNeutralChartColor() {
  const theme = useTheme();
  const config = useLegacyStore(ConfigStore);

  if (!theme.isChonk) {
    return theme.gray200;
  }

  const neutralColor =
    config.theme === 'dark'
      ? Color(theme.gray400).darken(0.35)
      : Color(theme.gray400).lighten(1.3);

  return neutralColor.toString();
}
