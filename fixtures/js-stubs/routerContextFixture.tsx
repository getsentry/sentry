import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {isObject} from 'sentry/sentryPropTypeValidators';

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
      router: isObject,
      location: isObject,
      organization: isObject,
      project: isObject,
      ...childContextTypes,
    },
  };
}
