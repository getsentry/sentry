import {t} from 'sentry/locale';
import {
  type Event,
  type EventGroupVariant,
  EventGroupVariantType,
} from 'sentry/types/event';
import {type Group, IssueCategory} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface EventGroupingInfoResponse {
  [variant: string]: EventGroupVariant;
}

function generatePerformanceGroupInfo({
  event,
  group,
}: {
  event: Event;
  group: Group | undefined;
}): EventGroupingInfoResponse | null {
  if (!event.occurrence) {
    return null;
  }

  const {evidenceData} = event.occurrence;

  const hash = event.occurrence?.fingerprint[0] || '';

  return group
    ? {
        [group.issueType]: {
          description: t('performance problem'),
          hash: event.occurrence?.fingerprint[0] || '',
          hashMismatch: false,
          key: group.issueType,
          type: EventGroupVariantType.PERFORMANCE_PROBLEM,
          evidence: {
            op: evidenceData?.op,
            parent_span_ids: evidenceData?.parentSpanIds,
            cause_span_ids: evidenceData?.causeSpanIds,
            offender_span_ids: evidenceData?.offenderSpanIds,
            desc: t('performance problem'),
            fingerprint: hash,
          },
        },
      }
    : null;
}

export function useEventGroupingInfo({
  event,
  group,
  projectSlug,
  query,
}: {
  event: Event;
  group: Group | undefined;
  projectSlug: string;
  query: Record<string, string>;
}) {
  const organization = useOrganization();

  const hasPerformanceGrouping =
    event.occurrence &&
    event.type === 'transaction' &&
    group?.issueCategory === IssueCategory.PERFORMANCE;

  const {data, isPending, isError, isSuccess} = useApiQuery<EventGroupingInfoResponse>(
    [
      `/projects/${organization.slug}/${projectSlug}/events/${event.id}/grouping-info/`,
      {query},
    ],
    {enabled: !hasPerformanceGrouping, staleTime: Infinity}
  );

  const groupInfo = hasPerformanceGrouping
    ? generatePerformanceGroupInfo({group, event})
    : data ?? null;

  return {groupInfo, isPending, isError, isSuccess, hasPerformanceGrouping};
}
