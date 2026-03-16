import {useCallback} from 'react';
import {useSortable} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid} from '@sentry/scraps/layout';

import {IconGrabbable} from 'sentry/icons/iconGrabbable';
import {t} from 'sentry/locale';
import {type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
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
  dragId: number;
  queryIndex: number;
  traceMetric: TraceMetric;
}

export function MetricToolbar({traceMetric, queryIndex, dragId}: MetricToolbarProps) {
  const metricQueries = useMultiMetricsQueryParams();
  const hasMultipleQueries = metricQueries.length > 1;
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const toggleVisibility = useCallback(() => {
    setVisualize(visualize.replace({visible: !visualize.visible}));
  }, [setVisualize, visualize]);
  const setTraceMetric = useSetTraceMetric();

  const {attributes, listeners, setNodeRef, transform} = useSortable({
    id: dragId,
    transition: null,
    disabled: !hasMultipleQueries,
  });

  return (
    <Grid
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform)}}
      width="100%"
      align="center"
      gap="md"
      columns={`${hasMultipleQueries ? '20px ' : ''}34px 2fr 3fr 6fr ${hasMultipleQueries ? '40px' : '0'}`}
      data-test-id="metric-toolbar"
      {...attributes}
    >
      {hasMultipleQueries && (
        <Button
          aria-label={t('Drag to reorder')}
          priority="transparent"
          size="zero"
          icon={<IconGrabbable size="sm" />}
          {...listeners}
        />
      )}
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
      {hasMultipleQueries && <DeleteMetricButton />}
    </Grid>
  );
}
