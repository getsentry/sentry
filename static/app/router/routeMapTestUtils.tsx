import type {RouteObject} from 'react-router-dom';

import {PRELOAD_HANDLE} from 'sentry/router/preload';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

/**
 * A single enumerated route in the application.
 *
 * This is the schema of the generated route-map artifact consumed downstream
 * (vendored into seer, see the `generateRouteMap` spec). One record is emitted
 * per terminal (element-bearing) route, in each customer-domain mode.
 */
interface RouteRecord {
  /**
   * Source module path of the route's component (e.g.
   * `sentry/views/dashboards/view`), or null for routes that resolve no
   * component or whose component path could not be recovered.
   */
  component: string | null;
  /**
   * Whether this record was produced with USING_CUSTOMER_DOMAIN enabled. The
   * same logical page appears twice across modes with different `url`s (the
   * customer-domain form vs. the `/organizations/:orgId/...` slug form).
   */
  customerDomain: boolean;
  /**
   * Ordered list of path parameters in `url` (`:param` names and `*` splats).
   */
  params: string[];
  /**
   * Full URL pattern formed by concatenating ancestor path segments.
   */
  url: string;
  /**
   * Arbitrary route metadata (`handle`), with the internal breadcrumb keys
   * stripped. Omitted when empty.
   */
  handle?: Record<string, unknown>;
  /**
   * Human-readable route name, primarily set on settings routes.
   */
  name?: string;
}

/**
 * Property under which the generator stamps the recovered component module
 * path onto a lazy-loaded component. See the `make` wrapper in the generator
 * spec.
 */
export const MODULE_PATH_KEY = '__modulePath';

const MODULE_PATH_RE = /(?:require|import)\(\s*["']([^"']+)["']\s*\)/;

/**
 * Recover the dynamic-import target from the source of a lazy-load thunk.
 *
 * `make(() => import('sentry/views/x'))` compiles (under swc) to a thunk whose
 * source contains `require("sentry/views/x")` (or `import("sentry/views/x")`).
 * We pull the module path back out of `thunk.toString()`.
 *
 * Returns null when no import target is present (e.g. a non-import thunk).
 */
export function extractModulePath(thunkSource: string): string | null {
  return thunkSource.match(MODULE_PATH_RE)?.[1] ?? null;
}

const PARAM_RE = /:(\w+)|(\*)/g;

/**
 * Extract the ordered path parameters from a URL pattern: named `:param`
 * segments and `*` splats, in the order they appear.
 */
export function extractParams(url: string): string[] {
  const params: string[] = [];
  for (const match of url.matchAll(PARAM_RE)) {
    params.push(match[1] ?? '*');
  }
  return params;
}

// Handle keys that translateSentryRoute injects for internal bookkeeping:
// the breadcrumb name, the unresolved path, and the preload thunk. These are
// not user-facing route metadata, so we strip them from the emitted `handle`.
const INTERNAL_HANDLE_KEYS = new Set<string>(['name', 'path', PRELOAD_HANDLE]);

function cleanHandle(
  handle: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!handle) {
    return undefined;
  }
  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(handle)) {
    // Skip internal keys, nullish values, and non-serializable values (e.g.
    // functions) — all of which would otherwise leave behind an empty object
    // in the JSON artifact.
    const value = handle[key];
    if (
      INTERNAL_HANDLE_KEYS.has(key) ||
      value === undefined ||
      value === null ||
      typeof value === 'function'
    ) {
      continue;
    }
    cleaned[key] = value;
  }
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function getComponentId(element: RouteObject['element']): string | null {
  if (!element || typeof element !== 'object' || !('type' in element)) {
    return null;
  }
  const type = (element as React.ReactElement).type as
    | (React.ComponentType & {[MODULE_PATH_KEY]?: string | null})
    | string;
  if (typeof type === 'string') {
    return null;
  }
  // Lazy routes (make()) carry the recovered import path. The generator stamps
  // this property even when the path can't be parsed, so its presence — not its
  // value — distinguishes a lazy component from a directly-imported one.
  if (MODULE_PATH_KEY in type) {
    return type[MODULE_PATH_KEY] ?? null;
  }
  // Directly-imported components (e.g. errorHandler(OverviewWrapper)) have no
  // import path to recover, so fall back to their display name / function name.
  // Requires the generator to identity-mock errorHandler so `type` is the real
  // component rather than the ErrorHandler wrapper.
  return type.displayName || type.name || null;
}

function isRedirectElement(element: RouteObject['element']): boolean {
  if (!element || typeof element !== 'object' || !('type' in element)) {
    return false;
  }
  const type = (element as React.ReactElement).type;
  if (typeof type === 'string') {
    return false;
  }
  // Matches both the react-router <Redirect> wrapper (displayName 'Redirect')
  // and directly-imported redirect components surfaced once errorHandler is
  // identity-mocked (e.g. ProjectEventRedirect, RedirectToRuleList, NoOp).
  const id = (type as React.ComponentType).displayName || (type as {name?: string}).name;
  return Boolean(id) && (/redirect/i.test(id!) || id === 'NoOp');
}

/**
 * Walk a resolved react-router route tree (as returned by `buildRoutes()`),
 * emitting one RouteRecord per terminal, element-bearing route.
 *
 * Modeled on `extractRoutes` in routes.spec.tsx: a queue-based descent that
 * accumulates the leading path. Container/layout routes (no element) and
 * redirect routes are skipped as records but still contribute their path to
 * descendants.
 */
export function walkRouteTree(
  roots: RouteObject[],
  customerDomain: boolean
): RouteRecord[] {
  const records: RouteRecord[] = [];
  const queue: Array<{leading: string; route: RouteObject}> = roots.map(route => ({
    leading: '',
    route,
  }));

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      break;
    }
    const {leading, route} = current;
    const currentPath = `${leading}${route.path ?? ''}`.replace('//', '/');

    for (const child of route.children ?? []) {
      queue.push({leading: currentPath, route: child});
    }

    // Structural (layout) node — no element to render, not a terminal route.
    if (!route.element) {
      continue;
    }

    // Redirects are navigation glue, not destinations.
    if (isRedirectElement(route.element)) {
      continue;
    }

    // The root container has no path, yielding an empty accumulated path;
    // represent it as the root URL so every emitted record has a non-empty url.
    const url = currentPath || '/';
    const handle = route.handle as Record<string, unknown> | undefined;
    records.push({
      url,
      params: extractParams(url),
      component: getComponentId(route.element),
      name: handle?.name as string | undefined,
      handle: cleanHandle(handle),
      customerDomain,
    });
  }

  return records;
}

/**
 * A deduplicated, user-renderable route — one record per logical page,
 * carrying both URL forms. This is the artifact schema consumed by seer.
 */
interface LogicalRoute {
  /**
   * Identifies the route's component. For lazy routes (the vast majority) this
   * is the source module path / default export (e.g.
   * `sentry/views/dashboards/view`). For the handful of directly-imported
   * components it falls back to the component's name (e.g. `OverviewWrapper`),
   * since there is no import path to recover. Never null.
   */
  component: string;
  /**
   * The route's URL pattern in authored slug form
   * (`/organizations/:orgId/dashboard/:dashboardId/`), which is always
   * navigable — on a customer domain it redirects to the slugless form. For
   * routes that only exist under customer domains, this is the slugless form.
   * Path params are visible inline as `:param` / `*` segments.
   */
  url: string;
  /**
   * Human-readable route name, primarily set on settings routes.
   */
  name?: string;
}

export interface RouteMap {
  meta: {
    /**
     * The customer-domain modes the tree was walked under.
     */
    customerDomainModes: boolean[];
    /**
     * Whether getsentry's route-injection overrides were registered before the
     * walk. When false, the map is the open-source subset, not the full SaaS
     * universe — never mistake a partial run for a complete one.
     */
    overridesPopulated: boolean;
    routeCount: number;
  };
  routes: LogicalRoute[];
}

/**
 * Derive the customer-domain (slugless) URL form from a slug URL, using the
 * app's own `normalizeUrl` so the transform exactly matches what users see at
 * render time. Handles every prefix form (`/organizations/:orgId`,
 * `/settings/:orgId`, `/onboarding/:orgId`, `/join-request/...`), not just the
 * org prefix.
 */
export function toCustomerDomainForm(url: string): string {
  return normalizeUrl(url, {forceCustomerDomain: true});
}

/**
 * Collapse the raw per-run records (slug run + customer-domain run) into one
 * logical route per page. The customer-domain run re-emits org routes both in
 * slug form and slugless form, so we key by (customer-domain form, component)
 * — the form invariant across both runs — and keep the first occurrence.
 *
 * The slug run is processed first so the canonical slug URL becomes the primary
 * `url`. Routes seen only in the customer-domain run are customer-domain-only.
 * Layout/container shells (null component) are dropped.
 */
export function dedupeRoutes(
  slugRecords: RouteRecord[],
  domainRecords: RouteRecord[],
  toCustomerDomain: (url: string) => string = toCustomerDomainForm
): LogicalRoute[] {
  const byKey = new Map<string, LogicalRoute>();

  const consider = (record: RouteRecord) => {
    if (!record.component) {
      return;
    }
    const urlCustomerDomain = toCustomerDomain(record.url);
    const key = `${urlCustomerDomain} ${record.component}`;
    if (byKey.has(key)) {
      return;
    }
    byKey.set(key, {
      url: record.url,
      component: record.component,
      ...(record.name ? {name: record.name} : {}),
    });
  };

  // Slug run first so the canonical slug URL wins as the emitted `url`.
  slugRecords.forEach(consider);
  domainRecords.forEach(consider);

  return [...byKey.values()].sort(
    (a, b) => a.url.localeCompare(b.url) || a.component.localeCompare(b.component)
  );
}

/**
 * Assemble the route map by walking the route tree under both customer-domain
 * modes, deduplicating to logical routes, and recording getsentry-override
 * coverage.
 *
 * The jest-only concerns (mocking `make` to stamp module paths, identity-
 * mocking the domain HOCs, and making USING_CUSTOMER_DOMAIN settable) live in
 * the generator spec; this function just drives them via injected callbacks so
 * the open-source and getsentry-context generators share one implementation.
 */
export function collectRouteMap(
  buildRoutes: () => RouteObject[],
  isOverridesPopulated: () => boolean,
  setCustomerDomain: (value: boolean) => void
): RouteMap {
  setCustomerDomain(false);
  const slugRecords = walkRouteTree(buildRoutes(), false);

  setCustomerDomain(true);
  const domainRecords = walkRouteTree(buildRoutes(), true);

  const routes = dedupeRoutes(slugRecords, domainRecords);

  return {
    meta: {
      overridesPopulated: isOverridesPopulated(),
      routeCount: routes.length,
      customerDomainModes: [false, true],
    },
    routes,
  };
}

/**
 * The getsentry route-injection hooks. When none are registered, the route map
 * is the open-source subset only.
 */
export const ROUTE_OVERRIDE_HOOKS = [
  'routes:root',
  'routes:org-settings',
  'routes:subscription-settings',
  'routes:legacy-organization-redirects',
] as const;
