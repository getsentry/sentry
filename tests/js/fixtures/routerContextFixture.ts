import {RouterFixture} from 'sentry-fixture/routerFixture';

import {SentryPropTypeValidators} from 'sentry/sentryPropTypeValidators';

export function RouterContextFixture([context, childContextTypes] = []) {
  return {
    context: {
      router: RouterFixture(),
      ...context,
    },
    childContextTypes: {
      router: SentryPropTypeValidators.isObject,
      ...childContextTypes,
    },
  };
}
