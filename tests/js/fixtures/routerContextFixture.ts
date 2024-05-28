import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {SentryPropTypeValidators} from 'sentry/sentryPropTypeValidators';

export function RouterContextFixture([context, childContextTypes] = []) {
  return {
    context: {
      location: LocationFixture(),
      router: RouterFixture(),
      organization: OrganizationFixture(),
      project: ProjectFixture(),
      ...context,
    },
    childContextTypes: {
      router: SentryPropTypeValidators.isObject,
      location: SentryPropTypeValidators.isObject,
      organization: SentryPropTypeValidators.isObject,
      project: SentryPropTypeValidators.isObject,
      ...childContextTypes,
    },
  };
}
