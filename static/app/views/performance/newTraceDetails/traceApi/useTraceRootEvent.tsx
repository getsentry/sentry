import type {EventTransaction} from 'sentry/types/event';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {
  type TraceItemDetailsResponse,
  useTraceItemDetails,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getRepresentativeTraceEvent} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {
  isEAPError,
  isTraceError,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useIsEAPTraceEnabled} from 'sentry/views/performance/newTraceDetails/useIsEAPTraceEnabled';

type Params = {
  logs: OurLogsResponseItem[] | undefined;
  traceId: string;
  tree: TraceTree;
};

export type TraceRootEventQueryResults =
  | UseApiQueryResult<EventTransaction, RequestError>
  | UseApiQueryResult<TraceItemDetailsResponse, RequestError>;

export function useTraceRootEvent({
  tree,
  logs,
  traceId,
}: Params): TraceRootEventQueryResults {
  const rep = getRepresentativeTraceEvent(tree, logs);
  const organization = useOrganization();

  // TODO: This is a bit of a mess, we won't need all of this once we switch to EAP only
  const treeIsLoading = tree.type === 'loading';
  const hasOnlyLogs = !!(tree.type === 'empty' && logs && logs.length > 0);
  const enabledBase =
    !treeIsLoading && (tree.type === 'trace' || hasOnlyLogs) && !!rep?.event && !!traceId;

  const isRepEventError =
    rep.event && OurLogKnownFieldKey.PROJECT_ID in rep.event
      ? false
      : isTraceError(rep.event) || isEAPError(rep.event);

  const isEAPTraceEnabled = useIsEAPTraceEnabled();
  const isEAPQueryEnabled =
    !isRepEventError && // Errors are not supported in EAP yet
    (isEAPTraceEnabled || (!treeIsLoading && hasOnlyLogs));

  const legacyRootEvent = useApiQuery<EventTransaction>(
    [
      `/organizations/${organization.slug}/events/${rep?.event?.project_slug}:${rep?.event?.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      // 10 minutes
      staleTime: 1000 * 60 * 10,
      enabled: enabledBase && !isEAPQueryEnabled,
    }
  );

  const projectId = rep.event
    ? OurLogKnownFieldKey.PROJECT_ID in rep.event
      ? rep.event[OurLogKnownFieldKey.PROJECT_ID]
      : rep.event.project_id
    : '';
  const eventId = rep.event
    ? OurLogKnownFieldKey.ID in rep.event
      ? rep.event[OurLogKnownFieldKey.ID]
      : rep.event.event_id
    : '';

  const rootEvent = useTraceItemDetails({
    traceItemId: String(eventId),
    projectId: String(projectId),
    traceId,
    traceItemType: rep?.type === 'log' ? TraceItemDataset.LOGS : TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details',
    enabled: enabledBase && isEAPQueryEnabled,
  });

  return isEAPQueryEnabled ? rootEvent : legacyRootEvent;
}
