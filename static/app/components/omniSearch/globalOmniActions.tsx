import {IconDiamond} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';

import {useOmniActions} from './useOmniActions';

/**
 * Hook which registers omni-actions which are globally available
 */
export function useGlobalOmniActions() {
  useOmniActions([
    {
      key: 'toggle-theme',
      label: t('Toggle Theme'),
      leadingItems: <IconDiamond size="sm" />,
      onAction: () =>
        ConfigStore.set('theme', ConfigStore.get('theme') === 'dark' ? 'light' : 'dark'),
    },
  ]);
}
