import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import type {MetricsProperty} from 'sentry/views/starfish/types';

type Props = {
  destination?: string;
  enabled?: boolean;
};

const yAxis: MetricsProperty[] = [
  'avg_if(span.self_time,span.op,queue.submit.celery)',
  'avg_if(span.self_time,span.op,queue.task.celery)',
  'count_op(queue.submit.celery)',
  'count_op(queue.task.celery)',
];

export function useQueuesTimeSeriesQuery({enabled, destination}: Props) {
  return useSpanMetricsSeries({
    yAxis,
    search: destination
      ? MutableSearch.fromQueryObject({
          transaction: destination, // TODO: This should filter by destination, not transaction
        })
      : undefined,
    referrer: 'api.performance.queues.module-chart',
    enabled,
  });
}
