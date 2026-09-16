import {
  slowDBQuerySpanFromEvent,
  slowDBQuerySpanFromTraceItem,
} from 'sentry/components/events/interfaces/performance/slowDBQuerySpan';
import {getSpanInfoFromTransactionEvent} from 'sentry/components/events/interfaces/performance/utils';
import {EventOrGroupType, type Event} from 'sentry/types/event';
import {getIssueTypeFromOccurrenceType, IssueType} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {
  traceItemDetailsApiOptions,
  type TraceItemDetailsResponse,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function usesSlowDBQuerySpanData(organization: Organization, event?: Event) {
  return (
    organization.features.includes('issue-details-slow-query-span-data') &&
    event?.type === EventOrGroupType.TRANSACTION &&
    getIssueTypeFromOccurrenceType(event.occurrence?.type) ===
      IssueType.PERFORMANCE_SLOW_DB_QUERY
  );
}

export function slowDBQueryEvidenceOptions({
  organization,
  event,
  projectSlug,
}: {
  organization: Organization;
  event?: Event;
  projectSlug?: string;
}) {
  const offenderSpanId: unknown = event?.occurrence?.evidenceData.offenderSpanIds?.[0];
  const traceId = event?.contexts.trace?.trace_id;
  const projectIdOrSlug = projectSlug ?? event?.projectID;
  const start = event?.type === EventOrGroupType.TRANSACTION ? event.startTimestamp : NaN;
  const end = event?.endTimestamp ?? NaN;
  const hasTimeRange = Number.isFinite(start) && Number.isFinite(end) && end >= start;
  const canFetch =
    usesSlowDBQuerySpanData(organization, event) &&
    typeof offenderSpanId === 'string' &&
    !!offenderSpanId &&
    !!traceId &&
    !!projectIdOrSlug &&
    hasTimeRange;

  return {
    ...traceItemDetailsApiOptions({
      organizationSlug: organization.slug,
      projectSlug: projectIdOrSlug ?? '',
      traceItemId: canFetch ? offenderSpanId : '',
      traceItemType: TraceItemDataset.SPANS,
      traceId: traceId ?? '',
      referrer: 'api.organization-trace-item-details',
      // Use the occurrence's segment bounds, not page filters or detection time.
      ...(hasTimeRange
        ? {
            start: new Date(start * 1000 - 1000).toISOString(),
            end: new Date(end * 1000 + 1000).toISOString(),
          }
        : {}),
    }),
    enabled: canFetch,
    retry: false,
  };
}

/** Resolve the same evidence for the pane and copying, including lookup failures. */
export function resolveSlowDBQueryEvidence(
  event?: Event,
  data?: TraceItemDetailsResponse
) {
  if (data) {
    return slowDBQuerySpanFromTraceItem(data);
  }

  return event?.type === EventOrGroupType.TRANSACTION && event.occurrence
    ? (slowDBQuerySpanFromEvent(
        getSpanInfoFromTransactionEvent(event)?.offendingSpans[0]
      ) ?? null)
    : null;
}
