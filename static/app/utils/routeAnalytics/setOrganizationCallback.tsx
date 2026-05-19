import type {Organization} from 'sentry/types/organization';

/**
 * A module-level cell that bridges RouteAnalyticsContext (React) and
 * organizationStore (Reflux). organizationStore cannot access React context
 * directly, so useRouteAnalyticsHookSetup registers the setOrganization
 * state setter here and organizationStore calls it when org data loads.
 */
let callback: ((org: Organization) => void) | undefined;

export function registerSetOrganizationCallback(fn: (org: Organization) => void): void {
  callback = fn;
}

export function callSetOrganizationCallback(org: Organization): void {
  callback?.(org);
}
