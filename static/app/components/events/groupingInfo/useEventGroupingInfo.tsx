import {t} from 'sentry/locale';
import {
  EventGroupVariantType,
  type Event,
  type EventGroupVariant,
} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type EventGroupingInfoResponseOld = Record<string, EventGroupVariant>;
type EventGroupingInfoResponse = {
  grouping_config: string;
  variants: Record<string, EventGroupVariant>;
};

function eventGroupingInfoResponseOldToNew(
  old: EventGroupingInfoResponseOld | null
): EventGroupingInfoResponse | null {
  const grouping_config = old
    ? (
        Object.values(old).find(
          variant => 'config' in variant && variant.config?.id
        ) as any
      )?.config?.id
    : null;
  return old
    ? {
        grouping_config,
        variants: old,
      }
    : null;
}
function isOld(
  data: EventGroupingInfoResponseOld | EventGroupingInfoResponse | null
): boolean {
  return data ? !('grouping_config' in data) : false;
}

function generatePerformanceGroupInfo({
  event,
  group,
}: {
  event: Event;
  group: Group | undefined;
}): EventGroupingInfoResponseOld | EventGroupingInfoResponse | null {
  if (!event.occurrence) {
    return null;
  }

  const {evidenceData} = event.occurrence;

  const hash = event.occurrence?.fingerprint[0] || '';

  return group
    ? {
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

  const {data, isPending, isError, isSuccess} = useApiQuery<
    EventGroupingInfoResponseOld | EventGroupingInfoResponse
  >([`/projects/${organization.slug}/${projectSlug}/events/${event.id}/grouping-info/`], {
    enabled: !hasPerformanceGrouping,
    staleTime: Infinity,
  });

  const groupInfo = hasPerformanceGrouping
    ? generatePerformanceGroupInfo({group, event})
    : (data ?? null);

  const groupInfoNew = isOld(groupInfo)
    ? eventGroupingInfoResponseOldToNew(groupInfo as EventGroupingInfoResponseOld)
    : (groupInfo as EventGroupingInfoResponse);

  return {
    groupInfo: groupInfoNew,
    isPending,
    isError,
    isSuccess,
    hasPerformanceGrouping,
  };
}
