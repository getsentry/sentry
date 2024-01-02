import {LocationFixture} from 'sentry-fixture/locationFixture';

export function RouterPropsFixture(params = {}) {
  return {
    location: LocationFixture(),
    params: {},
    routes: [],
    stepBack: () => {},
    ...params,
  };
}

// TODO(epurkhiser): Remove once removed from getsentry
export default RouterPropsFixture;
