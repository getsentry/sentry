import {Fragment, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import noop from 'lodash/noop';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {FormContext} from 'sentry/components/forms/formContext';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {t} from 'sentry/locale';
import {EQUATION_PREFIX} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {METRIC_DETECTOR_FORM_FIELDS} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {ToolbarVisualizeAddChart} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';
import {
  extractReferenceLabels,
  unresolveExpression,
} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {useMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import type {MetricQuery, TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsEquationsInAlerts} from 'sentry/views/explore/metrics/metricsFlags';
import {
  MetricsQueryParamsProvider,
  useMetricVisualize,
  useSetMetricVisualize,
  useTraceMetric,
} from 'sentry/views/explore/metrics/metricsQueryParams';
import {AggregateDropdown} from 'sentry/views/explore/metrics/metricToolbar/aggregateDropdown';
import {DeleteMetricButton} from 'sentry/views/explore/metrics/metricToolbar/deleteMetricButton';
import {Filter} from 'sentry/views/explore/metrics/metricToolbar/filter';
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector';
import {VisualizeLabel} from 'sentry/views/explore/metrics/metricToolbar/visualizeLabel';
import {
  LocalMultiMetricsQueryParamsProvider,
  MAX_METRICS_ALLOWED,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import {
  EQUATION_LABEL,
  parseAggregateExpression,
} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

const FUNCTION_GRID_COLUMNS = '24px 24px 3fr 2fr 6fr 40px';
const EQUATION_GRID_COLUMNS = '24px 24px 5fr 6fr 40px';

function computeEquationReferencedLabels(
  equationQuery: MetricQuery | undefined,
  referenceMap: Record<string, string>
): string[] {
  const visualize = equationQuery?.queryParams.visualizes[0];
  if (!visualize || !isVisualizeEquation(visualize)) {
    return [];
  }
  const labelSet = new Set(Object.keys(referenceMap));
  const unresolvedText = unresolveExpression(visualize.expression.text, referenceMap);
  return extractReferenceLabels(new Expression(unresolvedText, labelSet));
}

interface MetricsEquationVisualizeProps {
  /**
   * Form field that stores the aggregate expression. Defaults to the metric
   * detector field; the legacy alert form passes `aggregate`.
   */
  aggregateFieldName?: typeof METRIC_DETECTOR_FORM_FIELDS.aggregateFunction | 'aggregate';
  environments?: string[];
  /**
   * Called when the selected row's filter query changes. The legacy alert
   * form uses this to run `onFilterSearch` so the threshold chart refresh
   * on filter-bar edits.
   */
  onQueryChange?: (query: string) => void;
  projectIds?: number[];
}

export function MetricsEquationVisualize({
  aggregateFieldName = METRIC_DETECTOR_FORM_FIELDS.aggregateFunction,
  projectIds,
  environments,
  onQueryChange,
}: MetricsEquationVisualizeProps) {
  const organization = useOrganization();
  const hasEquations = canUseMetricsEquationsInAlerts(organization);
  const aggregateFunction = useFormField<string>(aggregateFieldName);
  const query = useFormField<string>(METRIC_DETECTOR_FORM_FIELDS.query);

  // Parse once at mount; subsequent aggregateFunction changes are intentionally
  // discarded so unsaved row edits survive form writes. Remounting the provider
  // (via a `key` on this component) is the escape hatch for true re-hydration.
  const initialQueries = useMemo(() => {
    const parsed = parseAggregateExpression(aggregateFunction ?? '', query);
    return parsed.equationRow
      ? [...parsed.metricQueries, parsed.equationRow]
      : parsed.metricQueries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LocalMultiMetricsQueryParamsProvider
      initialQueries={initialQueries}
      hasEquations={hasEquations}
    >
      <MetricsEquationVisualizeContent
        aggregateFieldName={aggregateFieldName}
        projectIds={projectIds}
        environments={environments}
        onQueryChange={onQueryChange}
      />
    </LocalMultiMetricsQueryParamsProvider>
  );
}

function MetricsEquationVisualizeContent({
  aggregateFieldName,
  projectIds,
  environments,
  onQueryChange,
}: {
  aggregateFieldName: string;
  environments?: string[];
  onQueryChange?: (query: string) => void;
  projectIds?: number[];
}) {
  const formContext = useContext(FormContext);
  const initialAggregate = useFormField<string>(aggregateFieldName);
  const metricQueries = useMultiMetricsQueryParams();
  const referenceMap = useMetricReferences(metricQueries);
  const addAggregate = useAddMetricQuery({type: 'aggregate'});
  const addEquation = useAddMetricQuery({type: 'equation'});

  // Track the selected row by its stable label (A, B, …)
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(() => {
    const match = metricQueries.find(
      q => q.queryParams.visualizes[0]?.yAxis === initialAggregate
    );
    return match?.label ?? metricQueries[0]?.label;
  });

  const onRowSelection = useCallback((label: string) => {
    setSelectedLabel(label);
  }, []);

  // Keep the form's aggregate + filter query in sync with whichever row the
  // radio currently points at, following edits to that row.
  useEffect(() => {
    let selectedQuery = metricQueries.find(q => q.label === selectedLabel);
    if (!selectedQuery && metricQueries.length > 0) {
      selectedQuery = metricQueries[0];
      setSelectedLabel(selectedQuery?.label);
    }

    const selectedYAxis = selectedQuery?.queryParams.visualizes[0]?.yAxis;
    const selectedFilter = selectedQuery?.queryParams.query;
    if (selectedYAxis !== undefined) {
      formContext.form?.setValue(aggregateFieldName, selectedYAxis);
    }
    if (selectedFilter !== undefined) {
      formContext.form?.setValue(METRIC_DETECTOR_FORM_FIELDS.query, selectedFilter);
      onQueryChange?.(selectedFilter);
    }
  }, [metricQueries, selectedLabel, formContext.form, aggregateFieldName, onQueryChange]);

  const functionQueries = useMemo(
    () => metricQueries.filter(q => isVisualizeFunction(q.queryParams.visualizes[0]!)),
    [metricQueries]
  );
  const equationQuery = useMemo(
    () => metricQueries.find(q => isVisualizeEquation(q.queryParams.visualizes[0]!)),
    [metricQueries]
  );

  // Labels (A, B, etc) from the function rows used inside the equation.
  const [equationReferencedLabels, setEquationReferencedLabels] = useState<string[]>(() =>
    computeEquationReferencedLabels(equationQuery, referenceMap)
  );
  const referencedLabels = useMemo(
    () => new Set(equationReferencedLabels),
    [equationReferencedLabels]
  );

  const hasEquationRow = Boolean(equationQuery);
  useEffect(() => {
    if (!hasEquationRow) {
      setEquationReferencedLabels([]);
    }
  }, [hasEquationRow]);

  return (
    <Stack gap="md" flex="1">
      {functionQueries.length > 0 && <FunctionColumnHeaders />}
      {functionQueries.map(metricQuery => {
        const isReferenced = referencedLabels.has(metricQuery.label ?? '');
        return (
          <RowProvider key={metricQuery.label ?? ''} metricQuery={metricQuery}>
            <MetricToolbar
              metricQuery={metricQuery}
              referenceMap={referenceMap}
              canDelete={functionQueries.length > 1 && !isReferenced}
              isSelected={selectedLabel === metricQuery.label}
              onRowSelection={onRowSelection}
              projectIds={projectIds}
              environments={environments}
            />
          </RowProvider>
        );
      })}
      {equationQuery && (
        <Fragment>
          <EquationColumnHeader />
          <RowProvider metricQuery={equationQuery}>
            <MetricToolbar
              metricQuery={equationQuery}
              referenceMap={referenceMap}
              canDelete
              isSelected={selectedLabel === equationQuery.label}
              onRowSelection={onRowSelection}
              onReferenceLabelsChange={setEquationReferencedLabels}
              projectIds={projectIds}
              environments={environments}
            />
          </RowProvider>
        </Fragment>
      )}
      <Flex gap="md" align="center">
        <ToolbarVisualizeAddChart
          add={addAggregate}
          disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
          label={t('Add Metric')}
          display="button"
        />
        {!equationQuery && (
          <ToolbarVisualizeAddChart
            display="button"
            add={addEquation}
            disabled={equationQuery || metricQueries.length >= MAX_METRICS_ALLOWED}
            label={t('Add Equation')}
          />
        )}
      </Flex>
    </Stack>
  );
}

function RowProvider({
  metricQuery,
  children,
}: {
  children: React.ReactNode;
  metricQuery: MetricQuery;
}) {
  return (
    <MetricsQueryParamsProvider
      queryParams={metricQuery.queryParams}
      traceMetric={metricQuery.metric}
      setTraceMetric={metricQuery.setTraceMetric}
      setQueryParams={metricQuery.setQueryParams}
      removeMetric={metricQuery.removeMetric}
    >
      {children}
    </MetricsQueryParamsProvider>
  );
}

function FunctionColumnHeaders() {
  return (
    <Grid width="100%" align="center" gap="md" columns={FUNCTION_GRID_COLUMNS}>
      <div style={{gridColumn: 'span 2'}} />
      <div>
        <Tooltip title={t('The metric to aggregate in this row.')} showUnderline>
          <SectionLabel>{t('Metric')}</SectionLabel>
        </Tooltip>
      </div>
      <div>
        <Tooltip title={t('The aggregation operation to apply.')} showUnderline>
          <SectionLabel>{t('Operation')}</SectionLabel>
        </Tooltip>
      </div>
      <div>
        <Tooltip
          title={t('Restrict this metric to events matching a filter.')}
          showUnderline
        >
          <SectionLabel>{t('Filter')}</SectionLabel>
        </Tooltip>
      </div>
      <div />
    </Grid>
  );
}

function EquationColumnHeader() {
  return (
    <Grid width="100%" align="center" gap="md" columns={EQUATION_GRID_COLUMNS}>
      <div style={{gridColumn: 'span 2'}} />
      <div>
        <Tooltip
          title={t('Combine the metrics above with an arithmetic expression.')}
          showUnderline
        >
          <SectionLabel>{t('Equation')}</SectionLabel>
        </Tooltip>
      </div>
      <div>
        <Tooltip
          title={t('Restrict this equation to events matching a filter.')}
          showUnderline
        >
          <SectionLabel>{t('Filter')}</SectionLabel>
        </Tooltip>
      </div>
      <div />
    </Grid>
  );
}

function MetricToolbar({
  metricQuery,
  referenceMap,
  canDelete,
  isSelected,
  onRowSelection,
  onReferenceLabelsChange,
  projectIds,
  environments,
}: {
  canDelete: boolean;
  isSelected: boolean;
  metricQuery: MetricQuery;
  onRowSelection: (label: string) => void;
  referenceMap: Record<string, string>;
  environments?: string[];
  onReferenceLabelsChange?: (labels: string[]) => void;
  projectIds?: number[];
}) {
  const visualize = useMetricVisualize();
  const setVisualize = useSetMetricVisualize();
  const traceMetric = useTraceMetric();
  const queryLabel = metricQuery.label ?? '';

  const setTraceMetric = useCallback(
    (newTraceMetric: TraceMetric) => {
      metricQuery.setTraceMetric(newTraceMetric);
    },
    [metricQuery]
  );
  const handleExpressionChange = (
    resolvedExpression: Expression,
    internalText: string
  ) => {
    if (isVisualizeEquation(visualize)) {
      setVisualize(
        visualize.replace({yAxis: `${EQUATION_PREFIX}${resolvedExpression.text}`})
      );
      // Report the user's typed labels (pre-resolve) so identical rows don't
      // collapse the lock onto whichever label sorts first in the map.
      const labelSet = new Set(Object.keys(referenceMap));
      const expr = new Expression(internalText, labelSet);
      onReferenceLabelsChange?.(extractReferenceLabels(expr));
    }
  };

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
      <Radio
        name="metricAggregateRow"
        checked={isSelected}
        onChange={() =>
          onRowSelection(isVisualizeEquation(visualize) ? EQUATION_LABEL : queryLabel)
        }
        aria-label={t('Use row %s as the alert aggregate', queryLabel)}
        disabled={isVisualizeFunction(visualize) && traceMetric.name === ''}
      />
      <VisualizeLabel
        label={queryLabel}
        visualize={visualize}
        onClick={noop}
        disableCollapse
      />
      {isVisualizeFunction(visualize) ? (
        <Fragment>
          <Flex minWidth={0}>
            <MetricSelector
              traceMetric={traceMetric}
              onChange={setTraceMetric}
              projectIds={projectIds}
              environments={environments}
            />
          </Flex>
          <AggregateDropdown traceMetric={traceMetric} singleSelect />
          <Filter traceMetric={traceMetric} />
          <DeleteMetricButton disabled={!canDelete} />
        </Fragment>
      ) : isVisualizeEquation(visualize) ? (
        <Fragment>
          <EquationBuilder
            expression={visualize.expression.text}
            referenceMap={referenceMap}
            handleExpressionChange={handleExpressionChange}
          />
          <Filter traceMetric={traceMetric} skipTraceMetricFilter />
          <DeleteMetricButton />
        </Fragment>
      ) : null}
    </Grid>
  );
}
