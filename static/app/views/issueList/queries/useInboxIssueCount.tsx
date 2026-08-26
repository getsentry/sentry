import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {orgHasSeerAccess} from 'sentry/utils/seer/orgHasSeerAccess';
import {useOrganization} from 'sentry/utils/useOrganization';

import {INBOX_AUTOFIX_CATEGORY_FILTER} from './inbox';

// Count all issues assigned or suggested to me across the displayed progress sections
const INBOX_COUNT_QUERY = `is:unresolved issue.progress:[fix_proposed,diagnosed,assigned,identified] assigned_or_suggested:me${INBOX_AUTOFIX_CATEGORY_FILTER}`;
const INBOX_COUNT_QUERY_NO_SEER = `is:unresolved issue.progress:[fix_proposed] assigned_or_suggested:me${INBOX_AUTOFIX_CATEGORY_FILTER}`;

export function useInboxIssueCount() {
  const organization = useOrganization();
  const inboxCountQuery = orgHasSeerAccess(organization)
    ? INBOX_COUNT_QUERY
    : INBOX_COUNT_QUERY_NO_SEER;

  return useQuery({
    ...apiOptions.as<Record<string, number>>()(
      '/organizations/$organizationIdOrSlug/issues-count/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          query: [inboxCountQuery],
        },
        staleTime: 180_000,
      }
    ),
    select: response => response.json[inboxCountQuery] ?? 0,
  });
}
