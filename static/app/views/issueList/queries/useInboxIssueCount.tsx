import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ASSIGNMENT_QUERY_SUFFIXES, SECTIONS} from 'sentry/views/issueList/pages/inbox';

/** Above this the badge shows `99+`; the endpoint caps each count at 100 anyway. */
export const INBOX_COUNT_MAX = 99;

const PROGRESS_STATES = SECTIONS.map(section => section.progress).join(', ');

// One query covering every section, with the inbox's default assignment filter
// (`my_teams` already includes the current user). The endpoint runs a separate
// Snuba search per `query` param, so a query per section would cost a search per
// section; `[...]` value lists keep it to one.
const INBOX_COUNT_QUERY = `issue.progress:[${PROGRESS_STATES}]${ASSIGNMENT_QUERY_SUFFIXES.my_teams}`;

/**
 * Total number of issues waiting in the inbox, for the nav badge.
 *
 * Queries all projects with no date or environment filter, matching the inbox
 * itself.
 */
export function useInboxIssueCount() {
  const organization = useOrganization();

  const {data} = useQuery({
    ...apiOptions.as<Record<string, number>>()(
      '/organizations/$organizationIdOrSlug/issues-count/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {query: [INBOX_COUNT_QUERY], project: [-1]},
        staleTime: 180_000,
      }
    ),
    // Keep the previous count visible across navigations rather than blanking.
    placeholderData: keepPreviousData,
  });

  return data?.[INBOX_COUNT_QUERY] ?? null;
}
