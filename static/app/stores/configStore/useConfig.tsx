import {useContext} from 'react';

import {ConfigContext} from 'sentry/stores/configStore/configContext';

import LegacyConfigStore from 'sentry/stores/configStore';
import {Config} from 'sentry/types/system';

export function useConfig(): [Config, (store: typeof LegacyConfigStore) => void] {
  const context = useContext(ConfigContext);

  if (!context) {
    throw new Error('useConfig called outside of ConfigProvider');
  }

  return context;
}
