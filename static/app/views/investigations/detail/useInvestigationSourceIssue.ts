import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';
import {groupApiOptions} from 'sentry/views/issueDetails/useGroup';

/**
 * Fetches the issue a breached metric investigation was started from. Disabled
 * when there is no issue.
 */
export function useInvestigationSourceIssue(groupId: string | null) {
  const organization = useOrganization();
  return useQuery({
    ...groupApiOptions({
      organizationSlug: organization.slug,
      groupId: groupId ?? '',
      environments: [],
    }),
    enabled: groupId !== null,
  });
}
