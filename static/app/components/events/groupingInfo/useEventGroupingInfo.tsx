import {t} from 'sentry/locale';
import {
  EventGroupVariantType,
  type Event,
  type EventGroupVariant,
} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type EventGroupingInfoResponse = {
  grouping_config: string | null;
  variants: Record<string, EventGroupVariant>;
};

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
        grouping_config: null,
        variants: {
          [group.issueType]: {
            contributes: true,
            description: t('performance problem'),
            hash: event.occurrence?.fingerprint[0] || '',
            hashMismatch: false,
            hint: null,
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
        },
      }
    : null;
}

export function useEventGroupingInfo({
  event,
  group,
  projectSlug,
}: {
  event: Event;
  group: Group | undefined;
  projectSlug: string;
}) {
  const organization = useOrganization();

  const hasPerformanceGrouping = event.occurrence && event.type === 'transaction';

  const {data, isPending, isError, isSuccess} = useApiQuery<EventGroupingInfoResponse>(
    [`/projects/${organization.slug}/${projectSlug}/events/${event.id}/grouping-info/`],
    {
      enabled: !hasPerformanceGrouping,
      staleTime: Infinity,
    }
  );

  const groupInfo = hasPerformanceGrouping
    ? generatePerformanceGroupInfo({group, event})
    : (data ?? null);

  return {
    groupInfo,
    isPending,
    isError,
    isSuccess,
    hasPerformanceGrouping,
  };
}
