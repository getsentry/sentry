import {type RefObject, useCallback, useEffect, useMemo, useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {generateFieldAsString} from 'sentry/utils/discover/fields';
import {BuilderStateMetricsQueryParamsProvider} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize/builderStateMetricsQueryParamsProvider';
import {MetricToolbar} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize/metricToolbar';
import {dispatchYAxisUpdate} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize/utils';
import {
  useWidgetBuilderDispatch,
  useWidgetBuilderStateSlice,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import type {EquationModeSnapshot} from 'sentry/views/dashboards/widgetBuilder/hooks/useTraceMetricsVisualizeModeState';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {getTraceMetricAggregateSource} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {
  extractReferenceLabels,
  syncEquationMetricQueries,
  unresolveExpression,
} from 'sentry/views/explore/metrics/equationBuilder/utils';
import {
  getMetricReferences,
  useMetricReferences,
} from 'sentry/views/explore/metrics/hooks/useMetricReferences';
import {type MetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {
  MAX_METRICS_ALLOWED,
  useAddMetricQuery,
  useMultiMetricsQueryParams,
} from 'sentry/views/explore/metrics/multiMetricsQueryParams';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

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

interface MetricQueryRowsProps {
  selectedLabel: string | undefined;
  setSelectedLabel: (label: string | undefined) => void;
  equationSnapshot?: RefObject<EquationModeSnapshot | null>;
}

export function MetricQueryRows({
  selectedLabel,
  setSelectedLabel,
  equationSnapshot,
}: MetricQueryRowsProps) {
  const state = useWidgetBuilderStateSlice('displayType', 'fields', 'yAxis');
  const dispatch = useWidgetBuilderDispatch();
  const metricQueries = useMultiMetricsQueryParams();

  // Keep the snapshot ref in sync so useTraceMetricsVisualizeModeState can
  // restore this state after a mode or dataset toggle.
  useEffect(() => {
    if (equationSnapshot) {
      equationSnapshot.current = {queries: metricQueries, selectedLabel};
    }
  }, [equationSnapshot, metricQueries, selectedLabel]);
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

  const functionQueries = useMemo(
    () =>
      metricQueries.filter(
        q =>
          defined(q.queryParams.visualizes[0]) &&
          isVisualizeFunction(q.queryParams.visualizes[0])
      ),
    [metricQueries]
  );
  const equationQuery = useMemo(
    () =>
      metricQueries.find(
        q =>
          defined(q.queryParams.visualizes[0]) &&
          isVisualizeEquation(q.queryParams.visualizes[0])
      ),
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

  // When a subcomponent of an equation is changed, we need to update our references so
  // equations can be updated correctly in response to the changes
  const handleSubcomponentChanged = useCallback(
    (changedLabel: string, updatedQueryParams: ReadableQueryParams) => {
      if (!isEquationSelected) {
        return;
      }

      const oldBaseQueries = metricQueries.map(q => ({
        queryParams: q.queryParams,
        metric: q.metric,
        label: q.label,
      }));
      const newBaseQueries = oldBaseQueries.map(q =>
        q.label === changedLabel ? {...q, queryParams: updatedQueryParams} : q
      );

      const oldRefMap = getMetricReferences(oldBaseQueries);
      const newRefMap = getMetricReferences(newBaseQueries);
      const synced = syncEquationMetricQueries(newBaseQueries, oldRefMap, newRefMap);

      const syncedEquation = synced.find(
        q =>
          defined(q.queryParams.visualizes[0]) &&
          isVisualizeEquation(q.queryParams.visualizes[0])
      );
      if (syncedEquation) {
        const yAxis = syncedEquation.queryParams.visualizes[0]?.yAxis;
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
      metricQueries,
      isEquationSelected,
      currentAggregate,
      state.displayType,
      state.fields,
      dispatch,
    ]
  );

  function handleRowRemoved(removedLabel: string) {
    if (removedLabel !== selectedLabel) {
      return;
    }
    const fallback = functionQueries.find(q => q.label !== removedLabel);
    if (fallback) {
      setSelectedLabel(fallback.label);
      const yAxis = fallback.queryParams.visualizes[0]?.yAxis;
      if (yAxis) {
        dispatchYAxisUpdate(
          yAxis,
          currentAggregate,
          state.displayType,
          state.fields,
          dispatch
        );
      }
      dispatch({
        type: BuilderStateAction.SET_QUERY,
        payload: [fallback.queryParams.query],
      });
    }
  }

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
          <BuilderStateMetricsQueryParamsProvider
            key={metricQuery.label ?? ''}
            metricQuery={metricQuery}
            isSelected={isSelected}
            onRemove={() => handleRowRemoved(metricQuery.label ?? '')}
            onSubcomponentChanged={handleSubcomponentChanged}
          >
            <MetricToolbar
              label={metricQuery.label ?? ''}
              referenceMap={referenceMap}
              deleteDisabledReason={deleteDisabledReason}
              isSelected={isSelected}
              onRowSelection={onRowSelection}
            />
          </BuilderStateMetricsQueryParamsProvider>
        );
      })}
      {equationQuery && (
        <BuilderStateMetricsQueryParamsProvider
          metricQuery={equationQuery}
          isSelected={isEquationSelected}
        >
          <MetricToolbar
            label={equationQuery.label ?? ''}
            referenceMap={referenceMap}
            isSelected={isEquationSelected}
            onRowSelection={onRowSelection}
            onReferenceLabelsChange={setEquationReferencedLabels}
            deleteDisabledReason={t('An equation is required')}
          />
        </BuilderStateMetricsQueryParamsProvider>
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
        <Button
          disabled
          variant="link"
          icon={<IconAdd />}
          tooltipProps={{
            title: t('Only a single equation is allowed at this time'),
          }}
          aria-label={t('Add Equation')}
        >
          {t('Add Equation')}
        </Button>
      </Flex>
    </Stack>
  );
}
