import {keepPreviousData, useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

// Count all issues assigned to me/my teams which are assigned or further along
const INBOX_COUNT_QUERY =
  'is:unresolved issue.progress:[fix_proposed,diagnosed,assigned] assignee:[me,my_teams]';

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
