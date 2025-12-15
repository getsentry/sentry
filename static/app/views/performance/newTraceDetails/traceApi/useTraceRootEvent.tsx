import type {EventTransaction} from 'sentry/types/event';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {
  useTraceItemDetails,
  type TraceItemDetailsResponse,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';
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
  const rep = tree.findRepresentativeTraceNode({logs});
  const organization = useOrganization();

  const treeIsLoading = tree.type === 'loading';

  const enabledBase = !treeIsLoading && !!rep?.event;

  const isRepLog = rep?.dataset === TraceItemDataset.LOGS;
  const isEAPQueryEnabled = !!(isRepLog || rep?.event?.isEAPEvent);

  const projectSlug = rep?.event?.projectSlug;
  const legacyRootEvent = useApiQuery<EventTransaction>(
    [
      `/organizations/${organization.slug}/events/${projectSlug}:${rep?.event?.id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      // 10 minutes
      staleTime: 1000 * 60 * 10,
      enabled: enabledBase && !isEAPQueryEnabled && !!projectSlug && !!rep?.event?.id,
    }
  );

  const projectId = rep?.event
    ? OurLogKnownFieldKey.PROJECT_ID in rep.event
      ? rep.event[OurLogKnownFieldKey.PROJECT_ID]
      : rep.event.projectId
    : '';
  const eventId = rep?.event
    ? OurLogKnownFieldKey.PROJECT_ID in rep.event
      ? rep.event[OurLogKnownFieldKey.ID]
      : rep.event.id
    : '';
  const dataset = rep?.dataset ?? TraceItemDataset.SPANS;

  const rootEvent = useTraceItemDetails({
    traceItemId: String(eventId),
    projectId: String(projectId),
    traceId,
    traceItemType: dataset,
    referrer: 'api.explore.log-item-details',
    enabled: enabledBase && isEAPQueryEnabled,
  });

  return isEAPQueryEnabled ? rootEvent : legacyRootEvent;
}
