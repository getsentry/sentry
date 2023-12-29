import {object as propTypesObject} from 'prop-types';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {Organization} from 'sentry-fixture/organization';
import {Project} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

export function RouterContextFixture([context, childContextTypes] = []) {
  return {
    context: {
      location: LocationFixture(),
      router: RouterFixture(),
      organization: Organization(),
      project: Project(),
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
