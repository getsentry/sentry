import {LocationFixture} from 'sentry-fixture/locationFixture';

import type {InjectedRouter} from 'sentry/types/legacyReactRouter';

/**
 * @deprecated Use `initialRouterConfig` and the real react-router instead.
 * https://develop.sentry.dev/frontend/using-rtl/#testing-route-changes
 */
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
