import {LocationFixture} from 'sentry-fixture/locationFixture';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';

export function RouterFixture(params = {}): InjectedRouter {
  return {
    push: jest.fn(),
    replace: jest.fn(),
    go: jest.fn(),
    goBack: jest.fn(),
    goForward: jest.fn(),
    isActive: jest.fn(),
    location: LocationFixture(),
    routes: [],
    params: {},
    ...params,
  };
}
