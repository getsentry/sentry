import {LocationFixture} from 'sentry-fixture/locationFixture';

export default function RouterPropsFixture(params = {}) {
  return {
    location: LocationFixture(),
    params: {},
    routes: [],
    stepBack: () => {},
    ...params,
  };
}
