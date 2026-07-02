/* eslint-disable no-console */
// This spec doubles as the route-map generator: with GENERATE_ROUTE_MAP set it
// writes the vendored artifact, which legitimately requires Node fs/path.
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

// Mirror routes.spec.tsx: replace USING_CUSTOMER_DOMAIN with a spy-able getter.
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

// Wrap the lazy-load factory so each route component carries the source module
// path recovered from its import thunk. This is the only place the path is
// available — at runtime every lazy component is an identical RouteLazyLoad.
jest.mock('sentry/makeLazyloadComponent', () => {
  const actual = jest.requireActual('sentry/makeLazyloadComponent');
  // Inlined (not imported) because jest hoists this factory above imports.
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

// Identity-mock the customer-domain HOCs. They only affect the *rendered*
// element, not the route tree's path structure, and they do not forward the
// __modulePath static — so without this, withOrgPath routes would lose their
// component path behind the wrapper.
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

// Identity-mock errorHandler so directly-imported route components (e.g.
// errorHandler(OverviewWrapper)) expose their real type — otherwise element.type
// is the ErrorHandler wrapper and the component identity is lost.
jest.mock('sentry/utils/errorHandler', () => ({
  __esModule: true,
  ...jest.requireActual('sentry/utils/errorHandler'),
  errorHandler: (component: unknown) => component,
}));

afterEach(() => {
  // Restore the USING_CUSTOMER_DOMAIN spy created per test so mock state does
  // not leak between tests.
  jest.restoreAllMocks();
});

/**
 * Build the route map for the current override-registration state. The
 * getsentry-context generator (static/gsApp/generateRouteMap.spec.tsx) has its
 * own copy since spec files cannot export.
 */
function generateRouteMap(): RouteMap {
  const spy = jest.spyOn(constants, 'USING_CUSTOMER_DOMAIN', 'get');
  return collectRouteMap(
    buildRoutes,
    () => ROUTE_OVERRIDE_HOOKS.some(name => Boolean(getOverride(name as OverrideName))),
    value => spy.mockReturnValue(value)
  );
}

/**
 * Write the route map to the artifact path when GENERATE_ROUTE_MAP is set, and
 * warn loudly if it is only the open-source subset.
 */
function writeRouteMap(map: RouteMap): string | null {
  if (!process.env.GENERATE_ROUTE_MAP) {
    return null;
  }
  const outPath = process.env.ROUTE_MAP_OUT ?? path.join(__dirname, 'routeMap.json');
  fs.writeFileSync(outPath, `${JSON.stringify(map, null, 2)}\n`);

  if (map.meta.overridesPopulated) {
    console.log(`[generateRouteMap] wrote ${map.routes.length} routes to ${outPath}`);
  } else {
    console.warn(
      '[generateRouteMap] getsentry route overrides were NOT registered. The ' +
        'emitted map is the open-source subset only. Use the getsentry-context ' +
        'generator (static/gsApp/generateRouteMap.spec.tsx) for the full SaaS route map.'
    );
  }
  return outPath;
}

describe('route map generation (open-source)', () => {
  it('enumerates deduplicated logical routes with resolved URLs and components', () => {
    const {routes} = generateRouteMap();

    // A computed-path route (dashboard) resolves to a concrete slug URL with
    // its component module path recovered.
    const dashboard = routes.find(
      r => r.url === '/organizations/:orgId/dashboard/:dashboardId/'
    );
    expect(dashboard).toBeDefined();
    expect(dashboard!.component).toEqual(expect.stringContaining('sentry/views'));

    // Deduplicated: no exact (url, component) pair repeats.
    const keys = routes.map(r => `${r.url} ${r.component}`);
    expect(new Set(keys).size).toBe(routes.length);

    // Every record has a non-empty URL and a (non-null) component.
    expect(routes.every(r => r.url.length > 0 && Boolean(r.component))).toBe(true);
  });

  it('records the open-source subset as a partial (no getsentry overrides)', () => {
    const {meta} = generateRouteMap();
    expect(meta.routeCount).toBeGreaterThan(0);
    // Without registerGsAppOverrides(), the route-injection hooks are empty.
    expect(meta.overridesPopulated).toBe(false);
  });

  it('writes the route-map artifact when GENERATE_ROUTE_MAP is set', () => {
    const outPath = writeRouteMap(generateRouteMap());
    if (outPath) {
      expect(fs.existsSync(outPath)).toBe(true);
    }
  });
});
