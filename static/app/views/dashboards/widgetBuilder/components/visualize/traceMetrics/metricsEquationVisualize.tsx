import {Fragment, useCallback, useMemo, useState} from 'react';
import noop from 'lodash/noop';

import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {
  EQUATION_PREFIX,
  explodeFieldString,
  generateFieldAsString,
  type Column,
} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {DisplayType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {
  getTraceMetricAggregateActionType,
  getTraceMetricAggregateSource,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {EquationBuilder} from 'sentry/views/explore/metrics/equationBuilder';
import {
  extractReferenceLabels,
  unresolveExpression,
} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {useMetricReferences} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {assignSequentialLabels} from 'sentry/views/explore/metrics/hooks/useStableLabels';
import {
  defaultMetricQuery,
  type BaseMetricQuery,
  type MetricQuery,
} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsEquationsInDashboards} from 'sentry/views/explore/metrics/metricsFlags';
import {
  MetricsQueryParamsProvider,
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

const GRID_COLUMNS = 'auto 1fr auto';

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

function dispatchYAxisUpdate(
  yAxis: string,
  currentAggregate: string,
  displayType: DisplayType | undefined,
  fields: Column[] | undefined,
  dispatch: ReturnType<typeof useWidgetBuilderContext>['dispatch']
) {
  if (yAxis === currentAggregate) {
    return;
  }
  const actionType = getTraceMetricAggregateActionType(displayType);
  const aggregate = explodeFieldString(yAxis);
  if (actionType === BuilderStateAction.SET_FIELDS) {
    const currentNonAggregates =
      fields?.filter(f => f.kind === FieldValueKind.FIELD) ?? [];
    dispatch({type: actionType, payload: [...currentNonAggregates, aggregate]});
  } else {
    dispatch({type: actionType, payload: [aggregate]});
  }
}

interface MetricsEquationVisualizeProps {
  onEquationRemoved: () => void;
}

export function MetricsEquationVisualize({
  onEquationRemoved,
}: MetricsEquationVisualizeProps) {
  const organization = useOrganization();
  const hasEquations = canUseMetricsEquationsInDashboards(organization);
  const {state, dispatch} = useWidgetBuilderContext();

  const aggregateSource = getTraceMetricAggregateSource(
    state.displayType,
    state.yAxis,
    state.fields
  );
  const currentAggregate = aggregateSource?.[0]
    ? generateFieldAsString(aggregateSource[0])
    : '';

  const initialQueries = useMemo(() => {
    // If there's an equation, we can parse it to get the metric queries and equation row
    const equationField = aggregateSource?.find(f => f.kind === FieldValueKind.EQUATION);
    if (equationField) {
      const parsed = parseAggregateExpression(generateFieldAsString(equationField));
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

    // Otherwise, we parse each function to get the available metric queries and
    // add a default equation row
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

  const [selectedLabel, setSelectedLabel] = useState<string | undefined>(() => {
    const labels = assignSequentialLabels(initialQueries);
    const matchIdx = initialQueries.findIndex(
      q => q.queryParams.visualizes[0]?.yAxis === currentAggregate
    );
    return matchIdx >= 0 ? labels[matchIdx] : labels[0];
  });

  // Sync the widget builder state with the new queries when there's a change
  // in the equation or the subcomponents.
  const handleQueriesChange = useCallback(
    (newQueries: BaseMetricQuery[]) => {
      const hasEquation = newQueries.some(q =>
        isVisualizeEquation(q.queryParams.visualizes[0]!)
      );

      // If there is no equation and this triggers, then we've just removed the last equation.
      // Select the first function row and clear the query.
      // TODO: This is temporary, the better fix is to put all of the subcomponents
      // into the aggregations and fill the filters into the widget builder state.
      if (!hasEquation) {
        const firstFunction = newQueries.find(q =>
          isVisualizeFunction(q.queryParams.visualizes[0]!)
        );
        if (firstFunction) {
          setSelectedLabel(firstFunction.label);
          const yAxis = firstFunction.queryParams.visualizes[0]?.yAxis;
          if (yAxis) {
            dispatchYAxisUpdate(
              yAxis,
              currentAggregate,
              state.displayType,
              state.fields,
              dispatch
            );
          }
        }
        dispatch({type: BuilderStateAction.SET_QUERY, payload: ['']});
        onEquationRemoved();
        return;
      }

      let selected = newQueries.find(q => q.label === selectedLabel);
      if (!selected && newQueries.length > 0) {
        selected = newQueries[0];
        setSelectedLabel(selected!.label);
        dispatch({
          type: BuilderStateAction.SET_QUERY,
          payload: [selected!.queryParams.query],
        });
      }
      if (selected) {
        const yAxis = selected.queryParams.visualizes[0]?.yAxis;
        if (yAxis) {
          dispatchYAxisUpdate(
            yAxis,
            currentAggregate,
            state.displayType,
            state.fields,
            dispatch
          );
        }
      }
    },
    [
      currentAggregate,
      selectedLabel,
      state.displayType,
      state.fields,
      dispatch,
      onEquationRemoved,
    ]
  );

  return (
    <LocalMultiMetricsQueryParamsProvider
      initialQueries={initialQueries}
      hasEquations={hasEquations}
      onQueriesChange={handleQueriesChange}
    >
      <MetricsEquationVisualizeContent
        selectedLabel={selectedLabel}
        setSelectedLabel={setSelectedLabel}
      />
    </LocalMultiMetricsQueryParamsProvider>
  );
}

function MetricsEquationVisualizeContent({
  selectedLabel,
  setSelectedLabel,
}: {
  selectedLabel: string | undefined;
  setSelectedLabel: (label: string | undefined) => void;
}) {
  const {state, dispatch} = useWidgetBuilderContext();
  const metricQueries = useMultiMetricsQueryParams();
  const referenceMap = useMetricReferences(metricQueries);
  const addAggregate = useAddMetricQuery({type: 'aggregate'});

  const aggregateSource = getTraceMetricAggregateSource(
    state.displayType,
    state.yAxis,
    state.fields
  );
  const currentAggregate = aggregateSource?.[0]
    ? generateFieldAsString(aggregateSource[0])
    : '';

  const onRowSelection = useCallback(
    (label: string) => {
      setSelectedLabel(label);
      const query = metricQueries.find(q => q.label === label);
      if (query) {
        dispatch({
          type: BuilderStateAction.SET_QUERY,
          payload: [query.queryParams.query],
        });
        const yAxis = query.queryParams.visualizes[0]?.yAxis;
        if (yAxis) {
          dispatchYAxisUpdate(
            yAxis,
            currentAggregate,
            state.displayType,
            state.fields,
            dispatch
          );
        }
      }
    },
    [
      currentAggregate,
      metricQueries,
      setSelectedLabel,
      state.displayType,
      state.fields,
      dispatch,
    ]
  );

  const handleMetricParamsChange = useCallback(
    (newQueryParams: ReadableQueryParams) => {
      dispatch({type: BuilderStateAction.SET_QUERY, payload: [newQueryParams.query]});
    },
    [dispatch]
  );

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
  const isEquationSelected = selectedLabel === equationQuery?.label;

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
            onQueryParamsChange={handleMetricParamsChange}
          >
            <MetricToolbar
              label={metricQuery.label ?? ''}
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
          isSelected={isEquationSelected}
          onQueryParamsChange={handleMetricParamsChange}
        >
          <MetricToolbar
            label={equationQuery.label ?? ''}
            referenceMap={referenceMap}
            isSelected={isEquationSelected}
            onRowSelection={onRowSelection}
            onReferenceLabelsChange={setEquationReferencedLabels}
          />
        </RowProvider>
      )}
      <Flex gap="md" align="center">
        <Button
          icon={<IconAdd />}
          onClick={addAggregate}
          disabled={metricQueries.length >= MAX_METRICS_ALLOWED}
          aria-label={t('Add Metric')}
          variant="link"
        >
          {t('Add Metric')}
        </Button>
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
  label,
  referenceMap,
  deleteDisabledReason,
  isSelected,
  onRowSelection,
  onReferenceLabelsChange,
}: {
  isSelected: boolean;
  label: string;
  onRowSelection: (label: string) => void;
  referenceMap: Record<string, string>;
  deleteDisabledReason?: string;
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
          onChange={() => onRowSelection(isEquation ? EQUATION_LABEL : label)}
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

      <Flex align="center" height="36px">
        <DeleteMetricButton
          disabledReason={isFunction ? deleteDisabledReason : undefined}
        />
      </Flex>
    </Grid>
  );
}
