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
