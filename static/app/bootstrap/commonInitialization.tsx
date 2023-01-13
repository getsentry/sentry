import 'focus-visible';

import {NODE_ENV} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types';

export function commonInitialization(config: Config) {
  if (NODE_ENV === 'development') {
    import(/* webpackMode: "eager" */ 'sentry/utils/silence-react-unsafe-warnings');
  }

  ConfigStore.loadInitialData(config);
}
