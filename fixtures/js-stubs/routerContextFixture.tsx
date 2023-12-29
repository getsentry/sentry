import {object as propTypesObject} from 'prop-types';
import LocationFixture from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

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
      router: propTypesObject,
      location: propTypesObject,
      organization: propTypesObject,
      project: propTypesObject,
      ...childContextTypes,
    },
  };
}

// TODO(epurkhiser): Remove once removed from getsentry
export default RouterContextFixture;
