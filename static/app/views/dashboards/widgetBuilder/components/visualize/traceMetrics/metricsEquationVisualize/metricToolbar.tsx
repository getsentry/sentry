import {Fragment} from 'react';
import noop from 'lodash/noop';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {
  DEFAULT_EQUATION_LABEL,
  RATE_AGGREGATES,
} from 'sentry/views/explore/metrics/constants';
import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';
import {extractReferenceLabels} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {
  useMetricVisualize,
  useSetMetricVisualize,
  useSetTraceMetric,
  useTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricToolbar/aggregateDropdown';
import {DeleteMetricButton} from 'sentry/views/explore/metrics/metricToolbar/deleteMetricButton';
import {Filter} from 'sentry/views/explore/metrics/metricToolbar/filter';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/metricSelector';
import {VisualizeLabel} from 'sentry/views/explore/metrics/metricToolbar/visualizeLabel';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

const RATE_AGGREGATE_DISABLED_REASON = t(
  'Rate aggregates are not supported in equations'
);
const DISABLED_EQUATION_AGGREGATES: Record<string, string> = Object.fromEntries(
  [...RATE_AGGREGATES].map(agg => [agg, RATE_AGGREGATE_DISABLED_REASON])
);

const GRID_COLUMNS = 'auto 1fr auto';

export function MetricToolbar({
  label,
  referenceMap,
  deleteDisabledReason,
  isSelected,
  onRowSelection,
  onReferenceLabelsChange,
  disabled,
}: {
  isSelected: boolean;
  label: string;
  onRowSelection: (label: string) => void;
  referenceMap: Record<string, string>;
  deleteDisabledReason?: string;
  disabled?: boolean;
  onReferenceLabelsChange?: (labels: string[]) => void;
}) {
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const traceMetric = useTraceMetric();
  const setTraceMetric = useSetTraceMetric();

  const handleExpressionChange = (
    resolvedExpression: Expression,
    internalText: string
  ) => {
    if (isVisualizeEquation(visualize)) {
      setVisualize(
        visualize.replace({
          yAxis: `${EQUATION_PREFIX}${resolvedExpression.text}`,
          internalExpression: internalText,
        })
      );
      const labelSet = new Set(Object.keys(referenceMap));
      const expr = new Expression(internalText, labelSet);
      onReferenceLabelsChange?.(extractReferenceLabels(expr));
    }
  };

  const isFunction = isVisualizeFunction(visualize);
  const isEquation = isVisualizeEquation(visualize);

  return (
    <Grid columns={GRID_COLUMNS} gap="md" align="start" data-test-id="metric-toolbar">
      <Flex align="center" gap="md" width="fit-content">
        <Radio
          name="metricAggregateRow"
          checked={isSelected}
          onChange={() => onRowSelection(isEquation ? DEFAULT_EQUATION_LABEL : label)}
          aria-label={t('Use row %s as the widget aggregate', label)}
          disabled={isFunction && traceMetric.name === ''}
        />
        <VisualizeLabel
          label={label}
          visualize={visualize}
          onClick={noop}
          disableCollapse
          aria-role="presentation"
        />
      </Flex>

      <Flex gap="md" wrap="wrap" align="center" minWidth="0">
        {isFunction ? (
          <Fragment>
            <Flex flex="2" minWidth="0">
              <MetricSelector
                traceMetric={traceMetric}
                onChange={setTraceMetric}
                usePortal
              />
            </Flex>
            <Flex flex="1" minWidth="0">
              <AggregateDropdown
                traceMetric={traceMetric}
                singleSelect
                disabledAggregates={DISABLED_EQUATION_AGGREGATES}
              />
            </Flex>
          </Fragment>
        ) : isEquation ? (
          <EquationBuilder
            expression={visualize.expression.text}
            referenceMap={referenceMap}
            handleExpressionChange={handleExpressionChange}
            disabled={disabled}
            storedInternalExpression={visualize.internalExpression}
          />
        ) : null}
        <Flex flex="1 1 100%" minWidth="0">
          <Filter
            traceMetric={traceMetric}
            skipTraceMetricFilter={isEquation}
            portalTarget={document.body}
            disabled={disabled}
            disableValidation
          />
        </Flex>
      </Flex>

      <Flex align="center" height="36px">
        <DeleteMetricButton disabledReason={deleteDisabledReason} />
      </Flex>
    </Grid>
  );
}
