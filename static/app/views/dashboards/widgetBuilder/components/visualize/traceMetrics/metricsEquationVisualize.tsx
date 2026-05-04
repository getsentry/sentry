import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import noop from 'lodash/noop';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {t} from 'sentry/locale';
import {
  EQUATION_PREFIX,
  explodeFieldString,
  generateFieldAsString,
} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {WidgetType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {
  getTraceMetricAggregateActionType,
  getTraceMetricAggregateSource,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {ToolbarVisualizeAddChart} from 'sentry/views/explore/components/toolbar/toolbarVisualize';
import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';
import {
  extractReferenceLabels,
  unresolveExpression,
} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {useMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {
  defaultMetricQuery,
  type BaseMetricQuery,
  type MetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsEquationsInDashboards} from 'sentry/views/explore/metrics/metricsFlags';
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
  onEquationRemoved: () => void;
}

export function MetricsEquationVisualize({
  onEquationRemoved,
}: MetricsEquationVisualizeProps) {
  const organization = useOrganization();
  const hasEquations = canUseMetricsEquationsInDashboards(organization);
  const {state} = useWidgetBuilderContext();

  const aggregateSource = getTraceMetricAggregateSource(
    state.displayType,
    state.yAxis,
    state.fields
  );

  const initialQueries = useMemo(() => {
    const firstField = aggregateSource?.[0];
    if (firstField?.kind === FieldValueKind.EQUATION) {
      const parsed = parseAggregateExpression(generateFieldAsString(firstField));
      return parsed.equationRow
        ? [...parsed.metricQueries, parsed.equationRow]
        : parsed.metricQueries;
    }

    const metricQueries: BaseMetricQuery[] = (aggregateSource ?? [])
      .filter(f => f.kind === FieldValueKind.FUNCTION)
      .map(f => {
        const parsed = parseAggregateExpression(generateFieldAsString(f));
        return parsed.metricQueries[0]!;
      });
    if (metricQueries.length === 0) {
      metricQueries.push(defaultMetricQuery());
    }
    metricQueries.push(defaultMetricQuery({type: 'equation'}));
    return metricQueries;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <LocalMultiMetricsQueryParamsProvider
      initialQueries={initialQueries}
      hasEquations={hasEquations}
    >
      <MetricsEquationVisualizeContent onEquationRemoved={onEquationRemoved} />
    </LocalMultiMetricsQueryParamsProvider>
  );
}

function MetricsEquationVisualizeContent({
  onEquationRemoved,
}: {
  onEquationRemoved: () => void;
}) {
  const {state, dispatch} = useWidgetBuilderContext();
  const metricQueries = useMultiMetricsQueryParams();
  const referenceMap = useMetricReferences(metricQueries);
  const addAggregate = useAddMetricQuery({type: 'aggregate'});
  const addEquation = useAddMetricQuery({type: 'equation'});

  const aggregateSource = getTraceMetricAggregateSource(
    state.displayType,
    state.yAxis,
    state.fields
  );
  const currentAggregate = aggregateSource?.[0]
    ? generateFieldAsString(aggregateSource[0])
    : '';

  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(() => {
    const match = metricQueries.find(
      q => q.queryParams.visualizes[0]?.yAxis === currentAggregate
    );
    return match?.label ?? metricQueries[0]?.label;
  });

  const onRowSelection = useCallback((label: string) => {
    setSelectedLabel(label);
  }, []);

  const lastSyncedYAxisRef = useRef<string | undefined>(undefined);
  const fieldsRef = useRef(state.fields);
  fieldsRef.current = state.fields;

  useEffect(() => {
    let selectedQuery = metricQueries.find(q => q.label === selectedLabel);
    if (!selectedQuery && metricQueries.length > 0) {
      selectedQuery = metricQueries[0];
      setSelectedLabel(selectedQuery?.label);
    }

    const selectedYAxis = selectedQuery?.queryParams.visualizes[0]?.yAxis;
    if (selectedYAxis === undefined || selectedYAxis === lastSyncedYAxisRef.current) {
      return;
    }
    lastSyncedYAxisRef.current = selectedYAxis;

    const actionType = getTraceMetricAggregateActionType(state.displayType);
    const column = explodeFieldString(selectedYAxis);

    if (actionType === BuilderStateAction.SET_Y_AXIS) {
      dispatch({type: actionType, payload: [column]});
    } else if (actionType === BuilderStateAction.SET_CATEGORICAL_AGGREGATE) {
      dispatch({type: actionType, payload: [column]});
    } else {
      const currentNonAggregates =
        fieldsRef.current?.filter(f => f.kind === FieldValueKind.FIELD) ?? [];
      dispatch({
        type: actionType,
        payload: [...currentNonAggregates, column],
      });
    }
  }, [metricQueries, selectedLabel, state.displayType, dispatch]);

  const functionQueries = useMemo(
    () => metricQueries.filter(q => isVisualizeFunction(q.queryParams.visualizes[0]!)),
    [metricQueries]
  );
  const equationQuery = useMemo(
    () => metricQueries.find(q => isVisualizeEquation(q.queryParams.visualizes[0]!)),
    [metricQueries]
  );

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
      onEquationRemoved();
    }
  }, [hasEquationRow, onEquationRemoved]);

  return (
    <Stack gap="md" flex="1">
      {functionQueries.length > 0 && <FunctionColumnHeaders />}
      {functionQueries.map(metricQuery => {
        const isReferenced = referencedLabels.has(metricQuery.label ?? '');
        const deleteDisabledReason =
          functionQueries.length <= 1
            ? t('At least one metric is required')
            : isReferenced
              ? t('This metric is used in an equation')
              : undefined;
        return (
          <RowProvider key={metricQuery.label ?? ''} metricQuery={metricQuery}>
            <MetricToolbar
              metricQuery={metricQuery}
              referenceMap={referenceMap}
              deleteDisabledReason={deleteDisabledReason}
              isSelected={selectedLabel === metricQuery.label}
              onRowSelection={onRowSelection}
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
              isSelected={selectedLabel === equationQuery.label}
              onRowSelection={onRowSelection}
              onReferenceLabelsChange={setEquationReferencedLabels}
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
            disabled={!!equationQuery || metricQueries.length >= MAX_METRICS_ALLOWED}
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
        <Tooltip
          title={t('The application metric to aggregate in this row.')}
          showUnderline
        >
          <SectionLabel>{t('Application Metric')}</SectionLabel>
        </Tooltip>
      </div>
      <div>
        <Tooltip title={t('The aggregation operation to apply.')} showUnderline>
          <SectionLabel>{t('Operation')}</SectionLabel>
        </Tooltip>
      </div>
      <div>
        <Tooltip
          title={t('Restrict this application metric to events matching a filter.')}
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
          title={t(
            'Combine the application metrics above with an arithmetic expression.'
          )}
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

function SectionLabel({children}: {children: React.ReactNode}) {
  return (
    <span style={{fontSize: '0.875rem', fontWeight: 600, color: 'var(--gray300)'}}>
      {children}
    </span>
  );
}

function MetricToolbar({
  metricQuery,
  referenceMap,
  deleteDisabledReason,
  isSelected,
  onRowSelection,
  onReferenceLabelsChange,
}: {
  isSelected: boolean;
  metricQuery: MetricQuery;
  onRowSelection: (label: string) => void;
  referenceMap: Record<string, string>;
  deleteDisabledReason?: string;
  onReferenceLabelsChange?: (labels: string[]) => void;
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
        aria-label={t('Use row %s as the widget aggregate', queryLabel)}
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
            <MetricSelector traceMetric={traceMetric} onChange={setTraceMetric} />
          </Flex>
          <AggregateDropdown traceMetric={traceMetric} singleSelect />
          <Filter traceMetric={traceMetric} />
          <DeleteMetricButton disabledReason={deleteDisabledReason} />
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

/**
 * Returns true if the widget builder should show the equation visualize mode.
 * This happens when trace metrics equations are enabled and the current yAxis
 * contains an equation entry.
 */
export function useIsEquationMode(): boolean {
  const organization = useOrganization();
  const {state} = useWidgetBuilderContext();

  if (state.dataset !== WidgetType.TRACEMETRICS) {
    return false;
  }
  if (!canUseMetricsEquationsInDashboards(organization)) {
    return false;
  }

  const aggregateSource = getTraceMetricAggregateSource(
    state.displayType,
    state.yAxis,
    state.fields
  );

  return (aggregateSource ?? []).some(f => f.kind === FieldValueKind.EQUATION);
}
