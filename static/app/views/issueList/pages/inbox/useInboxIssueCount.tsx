import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {INBOX_AUTOFIX_CATEGORY_FILTER} from 'sentry/views/issueList/pages/inbox/utils';

// Count all issues assigned or suggested to me across the displayed progress sections
const INBOX_COUNT_QUERY = `is:unresolved issue.progress:[fix_proposed,diagnosed,assigned,identified] assigned_or_suggested:me${INBOX_AUTOFIX_CATEGORY_FILTER}`;

export function useInboxIssueCount() {
  const organization = useOrganization();

  return useQuery({
    ...apiOptions.as<Record<string, number>>()(
      '/organizations/$organizationIdOrSlug/issues-count/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          query: [INBOX_COUNT_QUERY],
        },
        staleTime: 180_000,
      }
    ),
    select: response => response.json[INBOX_COUNT_QUERY] ?? 0,
  });
}
