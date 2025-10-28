import usePageFilters from 'sentry/utils/usePageFilters';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function useMetricTraceDetail(props: {
  metricId: string;
  projectId: string;
  traceId: string;
  enabled?: boolean;
}) {
  const {isReady: pageFiltersReady} = usePageFilters();
  return useTraceItemDetails({
    traceItemId: String(props.metricId),
    projectId: props.projectId,
    traceId: props.traceId,
    traceItemType: TraceItemDataset.TRACEMETRICS,
    referrer: 'api.explore.metric-trace-detail',
    enabled: props.enabled && pageFiltersReady,
  });
}
