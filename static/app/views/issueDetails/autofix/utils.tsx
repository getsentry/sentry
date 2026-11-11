import type {Location} from 'history';
import omit from 'lodash/omit';

import type {Organization} from 'sentry/types/organization';
import {
  makeIssueDetailsLocation,
  type IssueDetailsLocation,
} from 'sentry/views/issueDetails/issueDetailsQueryParams';
import {Tab} from 'sentry/views/issueDetails/types';

const AUTOFIX_PAGE_FEATURE = 'autofix-page';

const SEER_QUERY_PARAMS = ['seerDrawer', 'seerDrawerAction'];

export function hasAutofixPage(organization: Organization) {
  return organization.features.includes(AUTOFIX_PAGE_FEATURE);
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
 *
 * `seerDrawerAction` is read straight off the location by the autofix cards, so
 * it applies to both.
 */
export function makeSeerLocation({
  organization,
  groupId,
  action,
  query,
}: SeerLocationOptions): IssueDetailsLocation {
  const autofixPage = hasAutofixPage(organization);
  return makeIssueDetailsLocation({
    organization,
    groupId,
    tab: autofixPage ? Tab.AUTOFIX : Tab.DETAILS,
    // The seer params are derived here, so a caller forwarding the current
    // location cannot drag a stale copy of them along.
    query: {
      ...(omit(query, SEER_QUERY_PARAMS) as Location['query']),
      ...(autofixPage ? {} : {seerDrawer: 'true'}),
      ...(action ? {seerDrawerAction: action} : {}),
    },
  });
}
