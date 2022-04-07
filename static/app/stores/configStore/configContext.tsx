import {createContext} from 'react';

import LegacyConfigStore from 'sentry/stores/configStore';
import {Config} from 'sentry/types/system';

export const ConfigContext = createContext<
  [Config, (store: typeof LegacyConfigStore) => void] | null
>(null);
