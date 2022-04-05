import 'focus-visible';

import {NODE_ENV} from 'sentry/constants';
import LegacyConfigStore from 'sentry/stores/configStore';
import {Config} from 'sentry/types';
import {setupColorScheme} from 'sentry/utils/matchMedia';

export function commonInitialization(config: Config) {
  if (NODE_ENV === 'development') {
    import(/* webpackMode: "eager" */ 'sentry/utils/silence-react-unsafe-warnings');
  }

  LegacyConfigStore.loadInitialData(config);

  // setup darkmode + favicon
  setupColorScheme();
}
