import 'focus-visible';

import {NODE_ENV, UI_DEV_ENABLE_PROFILING} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import {Config} from 'sentry/types';

export function commonInitialization(config: Config) {
  if (NODE_ENV === 'development') {
    import(/* webpackMode: "eager" */ 'sentry/utils/silence-react-unsafe-warnings');
    if (UI_DEV_ENABLE_PROFILING) {
      config.sentryConfig.profilesSampleRate = 1.0; // Enable profiling on dev for now.
    }
  }

  ConfigStore.loadInitialData(config);
}
