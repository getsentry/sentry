import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import noop from 'lodash/noop';

import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';

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
import {MetricSelector} from 'sentry/views/explore/metrics/metricToolbar/metricSelector/metricSelector';
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
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

const GRID_COLUMNS = 'auto 1fr 40px';

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
        ? [
            ...parsed.metricQueries,
            {
              ...parsed.equationRow,
              queryParams: parsed.equationRow.queryParams.replace({
                query: state.query?.[0] ?? '',
              }),
            },
          ]
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

  const syncWidgetBuilderYAxis = useCallback(
    (yAxis: string) => {
      const actionType = getTraceMetricAggregateActionType(state.displayType);
      const column = explodeFieldString(yAxis);
      if (actionType === BuilderStateAction.SET_Y_AXIS) {
        dispatch({type: actionType, payload: [column]});
      } else if (actionType === BuilderStateAction.SET_CATEGORICAL_AGGREGATE) {
        dispatch({type: actionType, payload: [column]});
      } else {
        const currentNonAggregates =
          state.fields?.filter(f => f.kind === FieldValueKind.FIELD) ?? [];
        dispatch({type: actionType, payload: [...currentNonAggregates, column]});
      }
    },
    [state.displayType, state.fields, dispatch]
  );

  const syncWidgetBuilderFilter = useCallback(
    (query: string) => {
      dispatch({type: BuilderStateAction.SET_QUERY, payload: [query]});
    },
    [dispatch]
  );

  const handleFilterChange = useCallback(
    (newQueryParams: ReadableQueryParams) => {
      syncWidgetBuilderFilter(newQueryParams.query);
    },
    [syncWidgetBuilderFilter]
  );

  const onRowSelection = useCallback(
    (label: string) => {
      setSelectedLabel(label);
      const query = metricQueries.find(q => q.label === label);
      if (query) {
        syncWidgetBuilderFilter(query.queryParams.query);
      }
    },
    [metricQueries, syncWidgetBuilderFilter]
  );

  const selectedQuery = metricQueries.find(q => q.label === selectedLabel);
  const selectedYAxis = selectedQuery?.queryParams.visualizes[0]?.yAxis;

  useEffect(() => {
    if (!selectedQuery && metricQueries.length > 0) {
      setSelectedLabel(metricQueries[0]!.label);
      syncWidgetBuilderFilter(metricQueries[0]!.queryParams.query);
    }
  }, [selectedQuery, metricQueries, syncWidgetBuilderFilter]);

  const syncYAxisRef = useRef(syncWidgetBuilderYAxis);
  syncYAxisRef.current = syncWidgetBuilderYAxis;

  useEffect(() => {
    if (selectedYAxis) {
      syncYAxisRef.current(selectedYAxis);
    }
  }, [selectedYAxis]);

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
    <Stack gap="lg" flex="1">
      {functionQueries.map(metricQuery => {
        const isReferenced = referencedLabels.has(metricQuery.label ?? '');
        const deleteDisabledReason = isReferenced
          ? t('This metric is used in an equation')
          : functionQueries.length <= 1
            ? t('At least one metric is required')
            : undefined;
        const isSelected = selectedLabel === metricQuery.label;
        return (
          <RowProvider
            key={metricQuery.label ?? ''}
            metricQuery={metricQuery}
            isSelected={isSelected}
            onQueryParamsChange={handleFilterChange}
          >
            <MetricToolbar
              metricQuery={metricQuery}
              referenceMap={referenceMap}
              deleteDisabledReason={deleteDisabledReason}
              isSelected={isSelected}
              onRowSelection={onRowSelection}
            />
          </RowProvider>
        );
      })}
      {equationQuery && (
        <RowProvider
          metricQuery={equationQuery}
          isSelected={selectedLabel === equationQuery.label}
          onQueryParamsChange={handleFilterChange}
        >
          <MetricToolbar
            metricQuery={equationQuery}
            referenceMap={referenceMap}
            isSelected={selectedLabel === equationQuery.label}
            onRowSelection={onRowSelection}
            onReferenceLabelsChange={setEquationReferencedLabels}
          />
        </RowProvider>
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
  isSelected,
  onQueryParamsChange,
  children,
}: {
  children: React.ReactNode;
  isSelected: boolean;
  metricQuery: MetricQuery;
  onQueryParamsChange?: (newQueryParams: ReadableQueryParams) => void;
}) {
  const handleSetQueryParams = useCallback(
    (newQueryParams: ReadableQueryParams) => {
      metricQuery.setQueryParams(newQueryParams);
      if (isSelected) {
        onQueryParamsChange?.(newQueryParams);
      }
    },
    [metricQuery, isSelected, onQueryParamsChange]
  );

  return (
    <MetricsQueryParamsProvider
      queryParams={metricQuery.queryParams}
      traceMetric={metricQuery.metric}
      setTraceMetric={metricQuery.setTraceMetric}
      setQueryParams={handleSetQueryParams}
      removeMetric={metricQuery.removeMetric}
    >
      {children}
    </MetricsQueryParamsProvider>
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

  const isFunction = isVisualizeFunction(visualize);
  const isEquation = isVisualizeEquation(visualize);

  return (
    <Grid columns={GRID_COLUMNS} gap="md" align="start" data-test-id="metric-toolbar">
      <Flex align="center" gap="md" width="fit-content">
        <Radio
          name="metricAggregateRow"
          checked={isSelected}
          onChange={() => onRowSelection(isEquation ? EQUATION_LABEL : queryLabel)}
          aria-label={t('Use row %s as the widget aggregate', queryLabel)}
          disabled={isFunction && traceMetric.name === ''}
        />
        <VisualizeLabel
          label={queryLabel}
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
              <MetricSelector traceMetric={traceMetric} onChange={setTraceMetric} />
            </Flex>
            <Flex flex="1" minWidth="0">
              <AggregateDropdown traceMetric={traceMetric} singleSelect />
            </Flex>
          </Fragment>
        ) : isEquation ? (
          <EquationBuilder
            expression={visualize.expression.text}
            referenceMap={referenceMap}
            handleExpressionChange={handleExpressionChange}
          />
        ) : null}
        <Flex flex="1 1 100%" minWidth="0">
          <Filter traceMetric={traceMetric} skipTraceMetricFilter={isEquation} />
        </Flex>
      </Flex>

      <Flex align="center">
        <DeleteMetricButton
          disabledReason={isFunction ? deleteDisabledReason : undefined}
        />
      </Flex>
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
