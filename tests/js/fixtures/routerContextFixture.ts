import {LocationFixture} from 'sentry-fixture/locationFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {SentryPropTypeValidators} from 'sentry/sentryPropTypeValidators';

export function RouterContextFixture([context, childContextTypes] = []) {
  return {
    context: {
      location: LocationFixture(),
      router: RouterFixture(),
      ...context,
    },
    childContextTypes: {
      router: SentryPropTypeValidators.isObject,
      location: SentryPropTypeValidators.isObject,
      ...childContextTypes,
    },
  };
}
