import {
  NODE_ENV,
  UI_DEV_ENABLE_PROFILING,
  USE_REACT_QUERY_DEVTOOL,
} from 'sentry/constants';
import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types';

export function commonInitialization(config: Config) {
  if (NODE_ENV === 'development') {
    import(/* webpackMode: "eager" */ 'sentry/utils/silence-react-unsafe-warnings');
    if (UI_DEV_ENABLE_PROFILING) {
      config.sentryConfig.profilesSampleRate = 1.0; // Enable profiling on dev for now.
    }

    if (USE_REACT_QUERY_DEVTOOL) {
      config.devtools = {
        ...config.devtools,
        reactQuery: true,
      };
    }
  }

  ConfigStore.loadInitialData(config);
}
