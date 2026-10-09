import type {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';

import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';

const AUTOFIX_PAGE_FEATURE = 'autofix-page';

const SEER_QUERY_PARAMS = ['seerDrawer', 'seerDrawerAction'];

export function hasAutofixPage(organization: Organization) {
  return organization.features.includes(AUTOFIX_PAGE_FEATURE);
}

export function makeSeerPathname(organization: Organization, groupId: string) {
  return normalizeUrl(
    `/organizations/${organization.slug}/issues/${groupId}/${
      hasAutofixPage(organization) ? TabPaths[Tab.AUTOFIX] : TabPaths[Tab.DETAILS]
    }`
  );
}

/**
 * The query params that force Seer open at the destination. Without the
 * `autofix-page` flag that means `seerDrawer`, which the issue details page
 * watches; the autofix tab needs no such marker, the route is the marker.
 * `seerDrawerAction` is read straight off the location by the autofix cards, so
 * it applies to both.
 */
export function makeSeerQuery(
  organization: Organization,
  action?: string
): Record<string, string> {
  return {
    ...(hasAutofixPage(organization) ? {} : {seerDrawer: 'true'}),
    ...(action ? {seerDrawerAction: action} : {}),
  };
}

interface SeerLocationOptions {
  groupId: string;
  organization: Organization;
  /** Autofix action to run on arrival, e.g. 'retry_code_changes'. */
  action?: string;
  /** Extra query params to carry over, e.g. the current page filters. */
  query?: Record<string, unknown>;
}

/**
 * Single source of truth for "take me to Seer for this issue". Behind
 * `autofix-page` this is the issue's autofix tab; without it, the issue details
 * page with the Seer drawer forced open.
 */
export function makeSeerLocation({
  organization,
  groupId,
  action,
  query,
}: SeerLocationOptions): LocationDescriptorObject {
  return {
    pathname: makeSeerPathname(organization, groupId),
    // The seer params are derived here, so a caller forwarding the current
    // location cannot drag a stale copy of them along.
    query: {...omit(query, SEER_QUERY_PARAMS), ...makeSeerQuery(organization, action)},
  };
}
