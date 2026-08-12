import {MotionGlobalConfig} from 'framer-motion';

import {IS_ACCEPTANCE_TEST, NODE_ENV} from 'sentry/constants';
import {ConfigStore} from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';

if (IS_ACCEPTANCE_TEST || NODE_ENV === 'test') {
  MotionGlobalConfig.skipAnimations = true;
}

export function commonInitialization(config: Config) {
  if (NODE_ENV === 'development') {
    import(/* webpackMode: "eager" */ 'sentry/utils/silenceReactUnsafeWarnings');
  }

  ConfigStore.loadInitialData(config);
}
