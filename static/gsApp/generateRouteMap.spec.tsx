/* eslint-disable no-console */
// Full-coverage (SaaS) variant of the route-map generator: it registers the
// getsentry overrides before walking, so the four routes:* injection hooks
// resolve and the map covers the full sentry.io route universe.
//
// The jest mocks below are duplicated from generateRouteMap.spec.tsx because
// jest.mock factories are hoisted per-file and cannot be shared. The actual
// generation/emission logic is shared via routeMap.collectRouteMap.

// eslint-disable-next-line import/no-nodejs-modules
import fs from 'node:fs';
// eslint-disable-next-line import/no-nodejs-modules
import path from 'node:path';

import * as constants from 'sentry/constants';
import {getOverride} from 'sentry/overrideRegistry';
import type {RouteMap} from 'sentry/router/routeMapTestUtils';
import {collectRouteMap, ROUTE_OVERRIDE_HOOKS} from 'sentry/router/routeMapTestUtils';
import {buildRoutes} from 'sentry/router/routes';
import type {OverrideName} from 'sentry/types/overrides';

import {registerGsAppOverrides} from 'getsentry/registerOverrides';

jest.mock('sentry/constants', () => {
  const originalModule = jest.requireActual('sentry/constants');
  return {
    __esModule: true,
    ...originalModule,
    get USING_CUSTOMER_DOMAIN() {
      return false;
    },
  };
});

jest.mock('sentry/makeLazyloadComponent', () => {
  const actual = jest.requireActual('sentry/makeLazyloadComponent');
  const RE = /(?:require|import)\(\s*["']([^"']+)["']\s*\)/;
  return {
    __esModule: true,
    ...actual,
    makeLazyloadComponent: (resolve: () => Promise<unknown>, fallback?: unknown) => {
      const component = actual.makeLazyloadComponent(resolve, fallback);
      (component as Record<string, unknown>).__modulePath =
        resolve.toString().match(RE)?.[1] ?? null;
      return component;
    },
  };
});

jest.mock('sentry/utils/withDomainRequired', () => ({
  __esModule: true,
  ...jest.requireActual('sentry/utils/withDomainRequired'),
  withDomainRequired: (component: unknown) => component,
}));
jest.mock('sentry/utils/withDomainRedirect', () => ({
  __esModule: true,
  ...jest.requireActual('sentry/utils/withDomainRedirect'),
  withDomainRedirect: (component: unknown) => component,
}));
jest.mock('sentry/utils/errorHandler', () => ({
  __esModule: true,
  ...jest.requireActual('sentry/utils/errorHandler'),
  errorHandler: (component: unknown) => component,
}));

function generateRouteMap(): RouteMap {
  const spy = jest.spyOn(constants, 'USING_CUSTOMER_DOMAIN', 'get');
  return collectRouteMap(
    buildRoutes,
    () => ROUTE_OVERRIDE_HOOKS.some(name => Boolean(getOverride(name as OverrideName))),
    value => spy.mockReturnValue(value)
  );
}

describe('route map generation (getsentry / full coverage)', () => {
  beforeAll(() => {
    // Populate the override registry exactly as the SaaS app does at startup.
    registerGsAppOverrides();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves getsentry route-injection hooks', () => {
    const {meta} = generateRouteMap();
    expect(meta.overridesPopulated).toBe(true);
    expect(meta.routeCount).toBeGreaterThan(0);
  });

  it('includes getsentry-injected routes (e.g. subscription settings)', () => {
    const {routes} = generateRouteMap();
    const subscription = routes.find(r =>
      r.component?.includes('subscriptionSettingsLayout')
    );
    expect(subscription).toBeDefined();
  });

  it('writes the full route-map artifact when GENERATE_ROUTE_MAP is set', () => {
    if (!process.env.GENERATE_ROUTE_MAP) {
      return;
    }
    const map = generateRouteMap();
    const outPath = process.env.ROUTE_MAP_OUT ?? path.join(__dirname, 'routeMap.json');
    fs.writeFileSync(outPath, `${JSON.stringify(map, null, 2)}\n`);
    console.log(
      `[generateRouteMapGsApp] wrote ${map.routes.length} routes ` +
        `(overridesPopulated=${map.meta.overridesPopulated}) to ${outPath}`
    );
    expect(fs.existsSync(outPath)).toBe(true);
  });
});
