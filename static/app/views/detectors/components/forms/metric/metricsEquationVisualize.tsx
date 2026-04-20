import {Fragment, useMemo} from 'react';
import noop from 'lodash/noop';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {MetricsAggregateDropdown} from 'sentry/views/detectors/components/forms/metric/traceMetrics/metricsAggregateDropdown';
import {MetricsMetricSelector} from 'sentry/views/detectors/components/forms/metric/traceMetrics/metricsMetricSelector';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {MetricsDetectorSearchBar} from 'sentry/views/detectors/datasetConfig/components/metricsSearchBar';
import {ToolbarVisualizeAddChart} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';
import {extractReferenceLabels} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {useMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {VisualizeLabel} from 'sentry/views/explore/metrics/metricToolbar/visualizeLabel';
import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {parseMetricAggregate} from 'sentry/views/explore/metrics/parseMetricsAggregate';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

const FUNCTION_GRID_COLUMNS = '24px 3fr 2fr 6fr 40px';
const EQUATION_GRID_COLUMNS = '24px 5fr 6fr 40px';

export function MetricsEquationVisualize() {
  const aggregateFunction = useMetricDetectorFormField(
    METRIC_DETECTOR_FORM_FIELDS.aggregateFunction
  );
  const parsed = parseAggregateExpression(aggregateFunction ?? '');
  const referenceMap = useMetricReferences(parsed.metricQueries);

  // Labels (A, B, …) from parsed.metricQueries that are actually used inside
  // the equation expression. Metrics in this set cannot be deleted without
  // leaving dangling references.
  const referencedLabels = useMemo(() => {
    if (!parsed.compactExpression || parsed.metricQueries.length === 0) {
      return new Set<string>();
    }
    const labelSet = new Set(
      parsed.metricQueries
        .map(q => q.label)
        .filter((label): label is string => Boolean(label))
    );
    const expr = new Expression(parsed.compactExpression, labelSet);
    return new Set(extractReferenceLabels(expr));
  }, [parsed.compactExpression, parsed.metricQueries]);

  return (
    <Stack gap="md">
      {parsed.metricQueries.length > 0 && <FunctionColumnHeaders />}
      {parsed.metricQueries.map(metricQuery => {
        const isReferenced = referencedLabels.has(metricQuery.label ?? '');
        return (
          <MetricToolbar
            key={metricQuery.label ?? ''}
            metricQuery={metricQuery}
            referenceMap={referenceMap}
            canDelete={parsed.metricQueries.length > 1 && !isReferenced}
          />
        );
      })}
      {parsed.equationRow && (
        <Fragment>
          <EquationColumnHeader />
          <MetricToolbar
            metricQuery={{...parsed.equationRow, label: 'ƒ1'}}
            referenceMap={referenceMap}
            canDelete
          />
        </Fragment>
      )}
      <Flex gap="md" align="center">
        <ToolbarVisualizeAddChart
          add={() => {}}
          disabled={false}
          label={t('Add Metric')}
          display="button"
        />

        {!defined(parsed.equationRow) && (
          <ToolbarVisualizeAddChart
            display="button"
            add={() => {}}
            disabled={false}
            label={t('Add Equation')}
          />
        )}
      </Flex>
    </Stack>
  );
}

function FunctionColumnHeaders() {
  return (
    <Grid width="100%" align="center" gap="md" columns={FUNCTION_GRID_COLUMNS}>
      <div />
      <Tooltip title={t('The metric to aggregate in this row.')} showUnderline>
        <SectionLabel>{t('Metric')}</SectionLabel>
      </Tooltip>
      <Tooltip title={t('The aggregation operation to apply.')} showUnderline>
        <SectionLabel>{t('Operation')}</SectionLabel>
      </Tooltip>
      <Tooltip
        title={t('Restrict this metric to events matching a filter.')}
        showUnderline
      >
        <SectionLabel>{t('Filter')}</SectionLabel>
      </Tooltip>
      <div />
    </Grid>
  );
}

function EquationColumnHeader() {
  return (
    <Grid width="100%" align="center" gap="md" columns={EQUATION_GRID_COLUMNS}>
      <div />
      <Tooltip
        title={t('Combine the metrics above with an arithmetic expression.')}
        showUnderline
      >
        <SectionLabel>{t('Equation')}</SectionLabel>
      </Tooltip>
      <Tooltip
        title={t('Restrict this equation to events matching a filter.')}
        showUnderline
      >
        <SectionLabel>{t('Filter')}</SectionLabel>
      </Tooltip>
      <div />
    </Grid>
  );
}

function MetricToolbar({
  metricQuery,
  referenceMap,
  canDelete,
}: {
  canDelete: boolean;
  metricQuery: BaseMetricQuery;
  referenceMap: Record<string, string>;
}) {
  const environment = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.environment);
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);
  const projectIds = useMemo(() => {
    if (projectId) {
      return [Number(projectId)];
    }
    return [];
  }, [projectId]);

  const visualize = metricQuery.queryParams.visualizes[0]!;
  const traceMetric = metricQuery.metric;
  const queryLabel = metricQuery.label ?? '';
  const parsedAggregate = isVisualizeFunction(visualize)
    ? parseMetricAggregate(visualize.yAxis)
    : null;

  const setTraceMetric = () => {};
  const handleExpressionChange = () => {};
  const handleReferenceLabelsChange = () => {};

  return (
    <Grid
      width="100%"
      align="center"
      gap="md"
      columns={
        isVisualizeFunction(visualize) ? FUNCTION_GRID_COLUMNS : EQUATION_GRID_COLUMNS
      }
      data-test-id="metric-toolbar"
    >
      <VisualizeLabel
        label={queryLabel}
        visualize={visualize}
        onClick={noop}
        disableCollapse
      />
      {isVisualizeFunction(visualize) ? (
        <Fragment>
          <MetricsMetricSelector value={traceMetric} onChange={setTraceMetric} />
          <MetricsAggregateDropdown
            value={parsedAggregate?.aggregation ?? ''}
            onChange={() => {}}
          />
          <MetricsDetectorSearchBar
            initialQuery={metricQuery.queryParams.query}
            onSearch={() => {}}
            onClose={() => {}}
            projectIds={projectIds}
            environment={environment}
            traceMetric={traceMetric}
          />
          <Button
            priority="transparent"
            icon={<IconDelete />}
            size="zero"
            onClick={() => {}}
            disabled={!canDelete}
            tooltipProps={{
              title: canDelete ? undefined : t('This metric is used in an equation'),
            }}
            aria-label={t('Delete Metric')}
          />
        </Fragment>
      ) : isVisualizeEquation(visualize) ? (
        <Fragment>
          <EquationBuilder
            expression={visualize.expression.text}
            referenceMap={referenceMap}
            handleExpressionChange={handleExpressionChange}
            onReferenceLabelsChange={handleReferenceLabelsChange}
          />
          <MetricsDetectorSearchBar
            initialQuery={metricQuery.queryParams.query}
            onSearch={() => {}}
            onClose={() => {}}
            projectIds={projectIds}
            environment={environment}
            traceMetric={traceMetric}
          />
          <Button
            priority="transparent"
            icon={<IconDelete />}
            size="zero"
            onClick={() => {}}
            aria-label={t('Delete Equation')}
          />
        </Fragment>
      ) : null}
    </Grid>
  );
}
