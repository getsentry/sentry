import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {INBOX_AUTOFIX_CATEGORY_FILTER} from './inbox';

// Count all issues assigned to me/my teams which are assigned or further along
const INBOX_COUNT_QUERY = `is:unresolved issue.progress:[fix_proposed,diagnosed,assigned] assigned:[me,my_teams]${INBOX_AUTOFIX_CATEGORY_FILTER}`;
const INBOX_COUNT_QUERY_NO_SEER = `is:unresolved issue.progress:[fix_proposed] assigned:[me,my_teams]${INBOX_AUTOFIX_CATEGORY_FILTER}`;

export function useInboxIssueCount() {
  const organization = useOrganization();
  const hasSeer =
    !organization.hideAiFeatures &&
    (organization.features.includes('seat-based-seer-enabled') ||
      organization.features.includes('seer-added'));
  const inboxCountQuery = hasSeer ? INBOX_COUNT_QUERY : INBOX_COUNT_QUERY_NO_SEER;

  const {data} = useQuery({
    ...apiOptions.as<Record<string, number>>()(
      '/organizations/$organizationIdOrSlug/issues-count/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          query: [inboxCountQuery],
          project: [-1],
        },
        staleTime: 180_000,
      }
    ),
    placeholderData: keepPreviousData,
  });

  return data?.[inboxCountQuery] ?? null;
}
