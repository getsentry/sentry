import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ASSIGNMENT_QUERY_SUFFIXES, SECTIONS} from 'sentry/views/issueList/pages/inbox';

/** The endpoint stops counting at 100, so anything higher is a floor. */
export const INBOX_COUNT_MAX = 99;

const PROGRESS_STATES = SECTIONS.map(section => section.progress).join(', ');

// A separate Snuba search runs per `query` param, so all the states travel as one.
const INBOX_COUNT_QUERY = `issue.progress:[${PROGRESS_STATES}]${ASSIGNMENT_QUERY_SUFFIXES.my_teams}`;

/** Number of issues waiting in the inbox, for the nav badge. */
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
    placeholderData: keepPreviousData,
  });

  return data?.[INBOX_COUNT_QUERY] ?? null;
}
