import {Fragment, useCallback} from 'react';

import {Flex, Grid} from '@sentry/scraps/layout';

import {ArithmeticBuilder} from 'sentry/components/arithmeticBuilder';
import type {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';
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
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

interface MetricToolbarProps {
  queryLabel: string;
  traceMetric: TraceMetric;
  references?: Set<string>;
}

export function MetricToolbar({traceMetric, queryLabel, references}: MetricToolbarProps) {
  const organization = useOrganization();
  const breakpoints = useBreakpoints();
  const isNarrow = !breakpoints.md;
  const metricQueries = useMultiMetricsQueryParams();
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const toggleVisibility = useCallback(() => {
    setVisualize(visualize.replace({visible: !visualize.visible}));
  }, [setVisualize, visualize]);
  const setTraceMetric = useSetTraceMetric();

  // We need at least one metric visualized, but equations should always
  // be removable
  const canRemoveMetric =
    metricQueries.filter(q => isVisualizeFunction(q.queryParams.visualizes[0]!)).length >
      1 || isVisualizeEquation(visualize);

  const handleExpressionChange = useCallback(
    (newExpression: Expression) => {
      const isValid = newExpression.isValid;
      if (!isValid) {
        return;
      }
      setVisualize(visualize.replace({yAxis: `${EQUATION_PREFIX}${newExpression.text}`}));
    },
    [setVisualize, visualize]
  );

  if (canUseMetricsUIRefresh(organization)) {
    return (
      <Flex
        direction="column"
        gap="md"
        width="100%"
        paddingLeft="lg"
        paddingRight="lg"
        paddingTop="md"
        data-test-id="metric-toolbar"
      >
        <Grid
          align="center"
          gap="md"
          columns={
            isVisualizeFunction(visualize)
              ? isNarrow
                ? `auto 1fr 1fr ${canRemoveMetric ? '24px' : '0'}`
                : `auto 2fr 3fr 6fr ${canRemoveMetric ? '24px' : '0'}`
              : `auto 1fr ${canRemoveMetric ? '24px' : '0'}`
          }
        >
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
                  <AggregateDropdown traceMetric={traceMetric} />
                </Flex>
                <Flex flex="3 1 0" minWidth={0}>
                  <GroupBySelector traceMetric={traceMetric} />
                </Flex>
              </Flex>
              {!isNarrow && (
                <Flex minWidth={0}>
                  <Filter traceMetric={traceMetric} />
                </Flex>
              )}
            </Fragment>
          ) : isVisualizeEquation(visualize) ? (
            <ArithmeticBuilder
              aggregations={[]}
              expression={visualize.expression.text}
              functionArguments={[]}
              getFieldDefinition={() => null}
              references={references}
              setExpression={handleExpressionChange}
            />
          ) : null}
          {canRemoveMetric && <DeleteMetricButton />}
        </Grid>
        {isNarrow && isVisualizeFunction(visualize) && (
          <Filter traceMetric={traceMetric} />
        )}
      </Flex>
    );
  }

  return (
    <Grid
      width="100%"
      align="center"
      gap="md"
      columns={
        isVisualizeFunction(visualize)
          ? `34px 2fr 3fr 6fr ${canRemoveMetric ? '40px' : '0'}`
          : `34px 1fr ${canRemoveMetric ? '40px' : '0'}`
      }
      data-test-id="metric-toolbar"
    >
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
              <AggregateDropdown traceMetric={traceMetric} />
            </Flex>
            <Flex flex="3 1 0" minWidth={0}>
              <GroupBySelector traceMetric={traceMetric} />
            </Flex>
          </Flex>
          <Flex minWidth={0}>
            <Filter traceMetric={traceMetric} />
          </Flex>
        </Fragment>
      ) : isVisualizeEquation(visualize) ? (
        <ArithmeticBuilder
          aggregations={[]}
          expression={visualize.expression.text}
          functionArguments={[]}
          getFieldDefinition={() => null}
          references={references}
          setExpression={handleExpressionChange}
        />
      ) : null}
      {canRemoveMetric && <DeleteMetricButton />}
    </Grid>
  );
}
