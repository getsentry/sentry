import {Flex} from 'sentry/components/core/layout';
import {t} from 'sentry/locale';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricToolbar/aggregateDropdown';
import {DeleteMetricButton} from 'sentry/views/explore/metrics/metricToolbar/deleteMetricButton';
import {Filter} from 'sentry/views/explore/metrics/metricToolbar/filter';
import {GroupBySelector} from 'sentry/views/explore/metrics/metricToolbar/groupBySelector';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';

interface MetricToolbarProps {
  traceMetric: TraceMetric;
}

export function MetricToolbar({traceMetric}: MetricToolbarProps) {
  return (
    <div style={{width: '100%'}}>
      <Flex direction="row" gap="md" align="center">
        {t('Query')}
        <MetricSelector traceMetric={traceMetric} />
        <AggregateDropdown type={traceMetric.type} />
        {t('by')}
        <GroupBySelector metricName={traceMetric.name} />
        {t('where')}
        <Filter traceMetric={traceMetric} />
        <DeleteMetricButton />
      </Flex>
    </div>
  );
}
