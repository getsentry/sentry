import {useQuery} from 'sentry/utils/queryClient';
import {HOST} from 'sentry/views/starfish/utils/constants';
import type {
  Span,
  SpanMetrics,
} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';

export const useSpanMetrics = (span?: Span, referrer = 'span-metrics') => {
  const aggregatesQuery = span ? getAggregatesQuery(span) : '';

  const {isLoading, error, data} = useQuery<SpanMetrics[]>({
    queryKey: ['span-metrics', span?.group_id],
    queryFn: () =>
      fetch(`${HOST}/?query=${aggregatesQuery}&referrer=${referrer}`).then(res =>
        res.json()
      ),
    retry: false,
    initialData: [],
    enabled: Boolean(span),
  });

  return {isLoading, error, data: data[0]};
};

const getAggregatesQuery = (span: Span) => {
  return `
    SELECT
    min(timestamp) as first_seen,
    max(timestamp) as last_seen,
    sum(exclusive_time) as total_time
    FROM spans_experimental_starfish
    WHERE 1 == 1
    AND group_id = '${span.group_id}'
 `;
};
