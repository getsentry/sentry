import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function useExploreLogsTableRow(props: {
  logId: string | number;
  projectId: string;
  traceId: string;
  enabled?: boolean;
  routingHint?: string;
  timestamp?: number | null;
}) {
  const {isReady: pageFiltersReady} = usePageFilters();
  return useTraceItemDetails({
    traceItemId: String(props.logId),
    projectId: props.projectId,
    traceId: props.traceId,
    traceItemType: TraceItemDataset.LOGS,
    referrer: 'api.explore.log-item-details',
    enabled: props.enabled && pageFiltersReady,
    timestamp: props.timestamp,
    routingHint: props.routingHint,
  });
}
