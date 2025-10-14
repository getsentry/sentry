import {Flex} from 'sentry/components/core/layout';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricToolbar/aggregateDropdown';
import {DeleteMetricButton} from 'sentry/views/explore/metrics/metricToolbar/deleteMetricButton';
import {Filter} from 'sentry/views/explore/metrics/metricToolbar/filter';
import {GroupBySelector} from 'sentry/views/explore/metrics/metricToolbar/groupBySelector';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import QuerySymbol from 'sentry/views/explore/metrics/metricToolbar/querySymbol';

interface MetricToolbarProps {
  traceMetric: TraceMetric;
}

export function MetricToolbar({traceMetric}: MetricToolbarProps) {
  return (
    <div style={{width: '100%'}}>
      <Flex direction="row" gap="md" align="center">
        <QuerySymbol id={traceMetric.id} />
        <MetricSelector traceMetric={traceMetric} />
        <AggregateDropdown type={traceMetric.type} />
        <GroupBySelector metricName={traceMetric.name} />
        <Filter traceMetric={traceMetric} />
        <DeleteMetricButton />
      </Flex>
    </div>
  );
}
