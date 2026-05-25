import type {Group} from 'sentry/types/group';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery, type ApiQueryKey} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

export interface GroupSummaryData {
  groupId: string;
  headline: string;
  eventId?: string | null;
  possibleCause?: string | null;
  scores?: {
    fixabilityScore?: number | null;
    fixabilityScoreVersion?: number | null;
    isFixable?: boolean | null;
    possibleCauseConfidence?: number | null;
    possibleCauseNovelty?: number | null;
  } | null;
  trace?: string | null;
  whatsWrong?: string | null;
}

const makeGroupSummaryQueryKey = (
  organizationSlug: string,
  groupId: string,
  eventId?: string
): ApiQueryKey => [
  getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/summarize/', {
    path: {
      organizationIdOrSlug: organizationSlug,
      issueId: groupId,
    },
  }),
  {
    method: 'POST',
    data: eventId ? {event_id: eventId} : undefined,
  },
];

/**
 * Gets the data for group summary if it exists but doesn't fetch it.
 */
export function useGroupSummaryData(group: Group) {
  const organization = useOrganization();
  const queryKey = makeGroupSummaryQueryKey(organization.slug, group.id);

  const {data, isPending} = useApiQuery<GroupSummaryData>(queryKey, {
    staleTime: Infinity,
    enabled: false,
  });

  return {data, isPending};
}
