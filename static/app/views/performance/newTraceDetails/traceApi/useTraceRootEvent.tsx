import type {EventTransaction} from 'sentry/types/event';
import {useApiQuery, UseApiQueryResult} from 'sentry/utils/queryClient';
import RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {
  TraceItemDetailsResponse,
  useTraceItemDetails,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {getRepresentativeTraceEvent} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {TRACE_FORMAT_PREFERENCE_KEY} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

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
  const [storedTraceFormat] = useSyncedLocalStorageState(
    TRACE_FORMAT_PREFERENCE_KEY,
    'non-eap'
  );
  const enabledBase = tree.type === 'trace' && !!rep && !!rep.event && !!traceId;

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
      staleTime: 0,
      enabled: enabledBase && storedTraceFormat === 'non-eap',
    }
  );

  const rootEvent = useTraceItemDetails({
    traceItemId: String(rep?.event?.event_id),
    projectId: String(rep?.event?.project_id),
    traceId,
    traceItemType: rep?.type === 'log' ? TraceItemDataset.LOGS : TraceItemDataset.SPANS,
    referrer: 'api.explore.log-item-details',
    enabled: enabledBase && storedTraceFormat === 'eap',
  });

  return storedTraceFormat === 'eap' ? rootEvent : legacyRootEvent;
}
