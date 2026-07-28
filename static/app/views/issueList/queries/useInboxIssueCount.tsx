import {keepPreviousData, useQuery} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import {apiOptions, selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ASSIGNMENT_QUERY_SUFFIXES, SECTIONS} from 'sentry/views/issueList/pages/inbox';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

/** The navigation displays anything higher as a floor. */
export const INBOX_COUNT_MAX = 99;

const PROGRESS_STATES = SECTIONS.map(section => section.progress).join(', ');

const INBOX_COUNT_QUERY = `issue.progress:[${PROGRESS_STATES}]${ASSIGNMENT_QUERY_SUFFIXES.my_teams}`;

/** Number of issues waiting in the inbox, for the nav badge. */
export function useInboxIssueCount() {
  const organization = useOrganization();

  const {data} = useQuery({
    ...apiOptions.as<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        collapse: ['stats', 'unhandled'],
        limit: 1,
        project: [-1],
        query: INBOX_COUNT_QUERY,
        sort: IssueSortOptions.PROGRESS,
      },
      staleTime: 180_000,
    }),
    placeholderData: keepPreviousData,
    select: selectJsonWithHeaders,
  });

  return data?.headers['X-Hits'] ?? null;
}
