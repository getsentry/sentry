import {useContext} from 'react';

import {ConfigContext} from 'sentry/stores/configStore/configContext';
import {ConfigAction, ConfigState} from 'sentry/stores/configStore/configReducer';

export function useConfig<K extends keyof ConfigState>(): [
  ConfigState,
  React.Dispatch<ConfigAction<K>>
] {
  const context = useContext(ConfigContext);

  if (!context) {
    throw new Error('useConfig called outside of ConfigProvider');
  }

  return context;
}
