import type {RouteObject} from 'react-router-dom';

import {
  dedupeRoutes,
  extractModulePath,
  extractParams,
  MODULE_PATH_KEY,
  toCustomerDomainForm,
  walkRouteTree,
} from 'sentry/router/routeMap';

describe('extractModulePath', () => {
  it('recovers the import target from a require()-compiled thunk', () => {
    // This is the shape swc emits for `() => import('sentry/views/x')`.
    const source =
      '()=>Promise.resolve().then(()=>_interop_require_wildcard(require("sentry/views/dashboards/view")))';
    expect(extractModulePath(source)).toBe('sentry/views/dashboards/view');
  });

  it('recovers the import target from an untransformed import() thunk', () => {
    expect(extractModulePath("() => import('sentry/views/auth/login')")).toBe(
      'sentry/views/auth/login'
    );
  });

  it('returns null when there is no import target', () => {
    expect(extractModulePath('() => somethingElse()')).toBeNull();
  });
});

describe('extractParams', () => {
  it('extracts named params in order', () => {
    expect(extractParams('/organizations/:orgId/dashboard/:dashboardId/')).toEqual([
      'orgId',
      'dashboardId',
    ]);
  });

  it('captures splat segments', () => {
    expect(extractParams('/explore/:catchAll/*')).toEqual(['catchAll', '*']);
  });

  it('returns an empty list for a static path', () => {
    expect(extractParams('issues/')).toEqual([]);
  });
});

function elementWithModulePath(modulePath: string | null) {
  function Component() {
    return null;
  }
  if (modulePath !== null) {
    (Component as any)[MODULE_PATH_KEY] = modulePath;
  }
  return {type: Component, props: {}, key: null} as unknown as RouteObject['element'];
}

function redirectElement() {
  function RouteRedirect() {
    return null;
  }
  RouteRedirect.displayName = 'Redirect';
  return {type: RouteRedirect, props: {}, key: null} as unknown as RouteObject['element'];
}

describe('walkRouteTree', () => {
  it('emits one record per element-bearing route with full path and params', () => {
    const tree: RouteObject[] = [
      {
        path: '/',
        children: [
          {
            path: 'organizations/:orgId/',
            children: [
              {
                path: 'dashboard/:dashboardId/',
                element: elementWithModulePath('sentry/views/dashboards/view'),
                handle: {name: 'Dashboard'},
              },
            ],
          },
        ],
      },
    ];

    const records = walkRouteTree(tree, false);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      url: '/organizations/:orgId/dashboard/:dashboardId/',
      params: ['orgId', 'dashboardId'],
      component: 'sentry/views/dashboards/view',
      name: 'Dashboard',
      customerDomain: false,
    });
  });

  it('skips layout (no element) and redirect nodes but keeps their descendants', () => {
    const tree: RouteObject[] = [
      {
        path: 'settings/',
        // layout node — no element, must not be emitted
        children: [
          {
            path: 'account/',
            element: elementWithModulePath('sentry/views/settings/account'),
          },
          {
            path: 'old/',
            element: redirectElement(),
          },
        ],
      },
    ];

    const records = walkRouteTree(tree, false);

    expect(records).toHaveLength(1);
    expect(records[0]!.url).toBe('settings/account/');
  });

  it('tags records with the provided customerDomain flag', () => {
    const tree: RouteObject[] = [
      {path: 'issues/', element: elementWithModulePath('sentry/views/issueList')},
    ];
    expect(walkRouteTree(tree, true)[0]!.customerDomain).toBe(true);
  });

  it('records a null component when none can be recovered', () => {
    const tree: RouteObject[] = [
      {path: 'mystery/', element: elementWithModulePath(null)},
    ];
    expect(walkRouteTree(tree, false)[0]!.component).toBeNull();
  });
});

describe('toCustomerDomainForm', () => {
  // Backed by the app's real normalizeUrl, so it covers every prefix form.
  it('strips the org-slug prefix from org routes', () => {
    expect(toCustomerDomainForm('/organizations/:orgId/dashboard/:dashboardId/')).toBe(
      '/dashboard/:dashboardId/'
    );
  });

  it('strips the settings org-slug prefix', () => {
    expect(toCustomerDomainForm('/settings/:orgId/billing/overview/')).toBe(
      '/settings/billing/overview/'
    );
  });

  it('passes non-org URLs through unchanged', () => {
    expect(toCustomerDomainForm('/issues/')).toBe('/issues/');
  });
});

describe('dedupeRoutes', () => {
  // Inject a simple org-prefix stripper so the dedup logic is tested in
  // isolation from normalizeUrl.
  const toCD = (url: string) =>
    url.startsWith('/organizations/:orgId')
      ? url.slice('/organizations/:orgId'.length) || '/'
      : url;
  const slug = (url: string, component: string) => ({
    url,
    params: extractParams(url),
    component,
    customerDomain: false,
  });
  const domain = (url: string, component: string) => ({
    url,
    params: extractParams(url),
    component,
    customerDomain: true,
  });

  it('collapses slug + customer-domain variants into one logical route', () => {
    const routes = dedupeRoutes(
      [slug('/organizations/:orgId/issues/', 'sentry/views/issues')],
      [
        // The customer-domain run re-emits both forms.
        domain('/organizations/:orgId/issues/', 'sentry/views/issues'),
        domain('/issues/', 'sentry/views/issues'),
      ],
      toCD
    );

    expect(routes).toHaveLength(1);
    // The slug run wins, so the canonical slug URL is emitted as `url`.
    expect(routes[0]).toEqual({
      url: '/organizations/:orgId/issues/',
      component: 'sentry/views/issues',
    });
  });

  it('keeps the slugless form as url for routes seen only in the domain run', () => {
    const routes = dedupeRoutes(
      [],
      [domain('/onboarding/:step/', 'sentry/views/onboarding')],
      toCD
    );

    expect(routes).toHaveLength(1);
    expect(routes[0]!.url).toBe('/onboarding/:step/');
  });

  it('drops layout shells (null component)', () => {
    const routes = dedupeRoutes(
      [{url: '/settings/', params: [], component: null, customerDomain: false}],
      [],
      toCD
    );
    expect(routes).toHaveLength(0);
  });

  it('produces a stable order independent of input order', () => {
    const forward = dedupeRoutes([slug('/b/', 'b'), slug('/a/', 'a')], [], toCD).map(
      r => r.url
    );
    expect(forward).toEqual(['/a/', '/b/']);
  });
});
