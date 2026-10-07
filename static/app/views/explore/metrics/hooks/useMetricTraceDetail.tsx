import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function useMetricTraceDetail(props: {
  metricId: string;
  projectId: string;
  traceId: string;
  enabled?: boolean;
  routingHint?: string;
  timestamp?: number;
}) {
  return useTraceItemDetails({
    traceItemId: String(props.metricId),
    projectId: props.projectId,
    traceId: props.traceId,
    timestamp: props.timestamp,
    routingHint: props.routingHint,
    traceItemType: TraceItemDataset.TRACEMETRICS,
    referrer: 'api.explore.metric-trace-detail',
    enabled: props.enabled,
  });
}
