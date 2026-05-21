import {Fragment, useCallback} from 'react';
import type {DraggableAttributes} from '@dnd-kit/core';
import type {SyntheticListenerMap} from '@dnd-kit/core/dist/hooks/utilities';

import {Flex, Grid} from '@sentry/scraps/layout';

import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {DragReorderButton} from 'sentry/components/dnd/dragReorderButton';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';
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
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/metricSelector';
import {VisualizeLabel} from 'sentry/views/explore/metrics/metricToolbar/visualizeLabel';
import {useMultiMetricsQueryParams} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {ChartType} from 'sentry/views/insights/common/components/chart';

interface MetricToolbarProps {
  queryLabel: string;
  traceMetric: TraceMetric;
  dragAttributes?: DraggableAttributes;
  dragListeners?: SyntheticListenerMap;
  onEquationLabelsChange?: (equationLabel: string, labels: string[]) => void;
  onTitleChange?: (title: string) => void;
  referenceMap?: Record<string, string>;
  referencedMetricLabels?: Set<string>;
}

export function MetricToolbar({
  traceMetric,
  queryLabel,
  referenceMap,
  dragListeners,
  dragAttributes,
  referencedMetricLabels,
  onEquationLabelsChange,
  onTitleChange,
}: MetricToolbarProps) {
  const breakpoints = useBreakpoints();
  const isNarrow = !breakpoints.md;
  const metricQueries = useMultiMetricsQueryParams();
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const toggleVisibility = useCallback(() => {
    setVisualize(visualize.replace({visible: !visualize.visible}));
  }, [setVisualize, visualize]);
  const setTraceMetric = useSetTraceMetric();
  const isHeatmap = visualize.chartType === ChartType.HEATMAP;
  const disabledReason = isHeatmap
    ? t('Not configurable for Heat Map visualizations')
    : undefined;

  // We need at least one metric visualized, but equations should always
  // be removable.
  const canRemoveMetric =
    metricQueries.filter(q => isVisualizeFunction(q.queryParams.visualizes[0]!)).length >
      1 || isVisualizeEquation(visualize);

  // A metric function cannot be deleted if it is referenced by any equation.
  // referencedMetricLabels is precomputed from the stored equations and
  // overridden with exact labels when the user edits an equation, so that
  // duplicate metrics only block deletion of the specific label used.
  const isReferencedByEquation =
    isVisualizeFunction(visualize) && (referencedMetricLabels?.has(queryLabel) ?? false);

  const handleReferenceLabelsChange = useCallback(
    (labels: string[]) => {
      onEquationLabelsChange?.(queryLabel, labels);
    },
    [onEquationLabelsChange, queryLabel]
  );

  const handleExpressionChange = useCallback(
    (newExpression: Expression, internalText: string) => {
      setVisualize(visualize.replace({yAxis: `${EQUATION_PREFIX}${newExpression.text}`}));
      onTitleChange?.(internalText);
    },
    [setVisualize, visualize, onTitleChange]
  );

  const dndGrid = dragListeners ? 'auto ' : '';
  const removeMetric = canRemoveMetric ? '24px' : '';
  const columns = isVisualizeFunction(visualize)
    ? isNarrow
      ? `${dndGrid}auto 1fr 1fr ${removeMetric}`
      : `${dndGrid}auto 2fr 3fr 6fr ${removeMetric}`
    : `${dndGrid}auto 1fr ${removeMetric}`;

  return (
    <Flex
      direction="column"
      gap="md"
      width="100%"
      paddingLeft="xl"
      paddingRight="xl"
      paddingTop="md"
      data-test-id="metric-toolbar"
    >
      <Grid align="center" gap="md" columns={columns}>
        {dragListeners ? (
          <DragReorderButton iconSize="sm" {...dragListeners} {...dragAttributes} />
        ) : null}
        <VisualizeLabel
          label={queryLabel}
          visualize={visualize}
          onClick={toggleVisibility}
        />
        {isVisualizeFunction(visualize) ? (
          <Fragment>
            <Flex minWidth={0}>
              <MetricSelector traceMetric={traceMetric} onChange={setTraceMetric} />
            </Flex>
            <Flex gap="md" minWidth={0}>
              <Flex flex="2 1 0" minWidth={0}>
                <AggregateDropdown
                  traceMetric={traceMetric}
                  disabledReason={disabledReason}
                />
              </Flex>
              <Flex flex="3 1 0" minWidth={0}>
                <GroupBySelector
                  traceMetric={traceMetric}
                  disabledReason={disabledReason}
                />
              </Flex>
            </Flex>
            {!isNarrow && (
              <Flex minWidth={0}>
                <Filter traceMetric={traceMetric} />
              </Flex>
            )}
          </Fragment>
        ) : isVisualizeEquation(visualize) ? (
          // The flex definitions are more complex for this case to mirror the styling for the
          // visualizeFunction case.
          <Flex minWidth={0} gap="md">
            <Flex flex="16 1 0" minWidth={0}>
              <EquationBuilder
                expression={visualize.expression.text}
                referenceMap={referenceMap}
                handleExpressionChange={handleExpressionChange}
                onReferenceLabelsChange={handleReferenceLabelsChange}
              />
            </Flex>
            <Flex flex="9 1 0" minWidth={0}>
              <GroupBySelector traceMetric={traceMetric} skipTraceMetricFilter />
            </Flex>
            {!isNarrow && (
              <Flex flex="30 1 0" minWidth={0}>
                <Filter traceMetric={traceMetric} skipTraceMetricFilter />
              </Flex>
            )}
          </Flex>
        ) : null}
        {canRemoveMetric && (
          <DeleteMetricButton
            disabledReason={
              isReferencedByEquation ? t('This metric is used in an equation') : undefined
            }
          />
        )}
      </Grid>
      {isNarrow && (
        <Filter
          traceMetric={traceMetric}
          skipTraceMetricFilter={isVisualizeEquation(visualize)}
        />
      )}
    </Flex>
  );
}
