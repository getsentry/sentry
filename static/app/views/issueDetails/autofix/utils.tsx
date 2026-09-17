import type {LocationDescriptorObject} from 'history';

import type {Organization} from 'sentry/types/organization';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';

export const AUTOFIX_PAGE_FEATURE = 'autofix-page';

export function hasAutofixPage(organization: Organization) {
  return organization.features.includes(AUTOFIX_PAGE_FEATURE);
}

export function makeSeerPathname(organization: Organization, groupId: string) {
  return normalizeUrl(
    `/organizations/${organization.slug}/issues/${groupId}/${
      hasAutofixPage(organization) ? 'autofix/' : ''
    }`
  );
}

/**
 * The query params that force Seer open at the destination. Without the
 * `autofix-page` flag that means `seerDrawer`, which the issue details page
 * watches; the standalone page needs no such marker. `seerDrawerAction` is read
 * straight off the location by the autofix cards, so it applies to both.
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
 * `autofix-page` this is a standalone page; without it, the issue details page
 * with the Seer drawer forced open.
 */
export function makeSeerLocation({
  organization,
  groupId,
  action,
  query,
}: SeerLocationOptions): LocationDescriptorObject {
  return {
    pathname: makeSeerPathname(organization, groupId),
    query: {...query, ...makeSeerQuery(organization, action)},
  };
}
