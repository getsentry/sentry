import {useCallback} from 'react';

import {Flex, Grid} from '@sentry/scraps/layout';

import {useOrganization} from 'sentry/utils/useOrganization';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsUIRefresh} from 'sentry/views/explore/metrics/metricsFlags';
import {
  useMetricVisualize,
  useSetMetricVisualize,
  useSetTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricToolbar/aggregateDropdown';
import {DeleteMetricButton} from 'sentry/views/explore/metrics/metricToolbar/deleteMetricButton';
import {Filter} from 'sentry/views/explore/metrics/metricToolbar/filter';
import {GroupBySelector} from 'sentry/views/explore/metrics/metricToolbar/groupBySelector';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {VisualizeLabel} from 'sentry/views/explore/metrics/metricToolbar/visualizeLabel';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';

interface MetricToolbarProps {
  queryIndex: number;
  traceMetric: TraceMetric;
}

export function MetricToolbar({traceMetric, queryIndex}: MetricToolbarProps) {
  const organization = useOrganization();
  const metricQueries = useMultiMetricsQueryParams();
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const toggleVisibility = useCallback(() => {
    setVisualize(visualize.replace({visible: !visualize.visible}));
  }, [setVisualize, visualize]);
  const setTraceMetric = useSetTraceMetric();
  const canRemoveMetric = metricQueries.length > 1;

  if (canUseMetricsUIRefresh(organization)) {
    return (
      <Grid
        width="100%"
        align="center"
        gap="md"
        columns={`auto 2fr 3fr 6fr ${canRemoveMetric ? '24px' : '0'}`}
        data-test-id="metric-toolbar"
        paddingLeft="lg"
        paddingRight="lg"
        paddingTop="md"
      >
        <VisualizeLabel
          index={queryIndex}
          visualize={visualize}
          onClick={toggleVisibility}
        />
        <Flex minWidth={0}>
          <MetricSelector traceMetric={traceMetric} onChange={setTraceMetric} />
        </Flex>
        <Flex gap="md" minWidth={0}>
          <Flex flex="2 1 0" minWidth={0}>
            <AggregateDropdown traceMetric={traceMetric} />
          </Flex>
          <Flex flex="3 1 0" minWidth={0}>
            <GroupBySelector traceMetric={traceMetric} />
          </Flex>
        </Flex>
        <Flex minWidth={0}>
          <Filter traceMetric={traceMetric} />
        </Flex>
        {canRemoveMetric && <DeleteMetricButton />}
      </Grid>
    );
  }

  return (
    <Grid
      width="100%"
      align="center"
      gap="md"
      columns={`34px 2fr 3fr 6fr ${canRemoveMetric ? '40px' : '0'}`}
      data-test-id="metric-toolbar"
    >
      <VisualizeLabel
        index={queryIndex}
        visualize={visualize}
        onClick={toggleVisibility}
      />
      <Flex minWidth={0}>
        <MetricSelector traceMetric={traceMetric} onChange={setTraceMetric} />
      </Flex>
      <Flex gap="md" minWidth={0}>
        <Flex flex="2 1 0" minWidth={0}>
          <AggregateDropdown traceMetric={traceMetric} />
        </Flex>
        <Flex flex="3 1 0" minWidth={0}>
          <GroupBySelector traceMetric={traceMetric} />
        </Flex>
      </Flex>
      <Flex minWidth={0}>
        <Filter traceMetric={traceMetric} />
      </Flex>
      {canRemoveMetric && <DeleteMetricButton />}
    </Grid>
  );
}
