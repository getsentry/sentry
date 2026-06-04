import {type RefObject, useCallback, useEffect, useRef, useState} from 'react';

import {
  explodeFieldString,
  generateFieldAsString,
  type QueryFieldValue,
} from 'sentry/utils/discover/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {WidgetType} from 'sentry/views/dashboards/types';
import {dispatchYAxisUpdate} from 'sentry/views/dashboards/widgetBuilder/components/visualize/traceMetrics/metricsEquationVisualize/utils';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {
  getTraceMetricAggregateActionType,
  getTraceMetricAggregateSource,
} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {assignSequentialLabels} from 'sentry/views/explore/metrics/hooks/useStableLabels';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {defaultMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {canUseMetricsEquationsInDashboards} from 'sentry/views/explore/metrics/metricsFlags';
import {parseAggregateExpression} from 'sentry/views/explore/metrics/parseAggregateExpression';
import {
  isVisualizeEquation,
  isVisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

interface SeriesModeSnapshot {
  fields: QueryFieldValue[];
  query: string[];
}

export interface EquationModeSnapshot {
  queries: BaseMetricQuery[];
  selectedLabel: string | undefined;
}

export interface TraceMetricsVisualizeModeState {
  equationSnapshot: RefObject<EquationModeSnapshot | null>;
  handleModeToggle: (nextIsEquation: boolean) => void;
  isEquationMode: boolean;
}

/**
 * Manages the series/equation mode toggle for trace-metric widgets.
 *
 * Owns the `isEquationMode` flag and caches each mode's visualize
 * state so toggling between them, or switching datasets and back,
 * restores the prior configuration.
 *
 * Series state is snapshotted from the builder state on toggle.
 * Equation state is kept in sync by MetricsEquationVisualize via
 * the returned equationSnapshot ref.
 */
export function useTraceMetricsVisualizeModeState(): TraceMetricsVisualizeModeState {
  const organization = useOrganization();
  const {state, dispatch} = useWidgetBuilderContext();

  const hasEquations = canUseMetricsEquationsInDashboards(organization);

  const [isEquationMode, setIsEquationMode] = useState(() => {
    if (state.dataset !== WidgetType.TRACEMETRICS || !hasEquations) {
      return false;
    }
    const aggregateSource = getTraceMetricAggregateSource(
      state.displayType,
      state.yAxis,
      state.fields
    );
    return (aggregateSource ?? []).some(f => f.kind === FieldValueKind.EQUATION);
  });

  const seriesSnapshot = useRef<SeriesModeSnapshot | null>(null);
  const equationSnapshot = useRef<EquationModeSnapshot | null>(null);
  const wasEquationModeOnLeave = useRef(isEquationMode);

  const restoreSeriesState = useCallback(() => {
    if (seriesSnapshot.current) {
      const actionType = getTraceMetricAggregateActionType(state.displayType);
      dispatch({type: actionType, payload: seriesSnapshot.current.fields});
      dispatch({
        type: BuilderStateAction.SET_QUERY,
        payload: seriesSnapshot.current.query,
      });
      return;
    }

    // No series snapshot — derive from the equation snapshot which has
    // the most up-to-date subcomponent queries.
    const snapshot = equationSnapshot.current;
    let derivedFields: QueryFieldValue[] = [];

    if (snapshot) {
      const functionQueries = snapshot.queries.filter(q => {
        const vis = q.queryParams.visualizes[0];
        return vis && isVisualizeFunction(vis);
      });

      for (const functionQuery of functionQueries) {
        const yAxis = functionQuery.queryParams.visualizes[0]?.yAxis;
        if (yAxis) {
          derivedFields.push(explodeFieldString(yAxis));
        }
      }
    }

    if (derivedFields.length === 0) {
      derivedFields = [getDatasetConfig(WidgetType.TRACEMETRICS).defaultField];
    }

    seriesSnapshot.current = {fields: derivedFields, query: []};
    const actionType = getTraceMetricAggregateActionType(state.displayType);
    dispatch({type: actionType, payload: derivedFields});
    dispatch({
      type: BuilderStateAction.SET_QUERY,
      payload: [],
    });
  }, [state.displayType, dispatch]);

  const restoreEquationState = useCallback(() => {
    let snapshot = equationSnapshot.current;

    if (!snapshot) {
      // If no equation snapshot state, then we need to derive the first state to
      // update the widget builder
      const aggregateSource = getTraceMetricAggregateSource(
        state.displayType,
        state.yAxis,
        state.fields
      );

      const queries = (aggregateSource ?? [])
        .filter(f => f.kind === FieldValueKind.FUNCTION)
        .map(f => {
          const parsed = parseAggregateExpression(generateFieldAsString(f));
          return parsed.metricQueries[0] ?? defaultMetricQuery();
        })
        .filter(Boolean);
      if (queries.length === 0) {
        queries.push(defaultMetricQuery());
      }
      queries.push(defaultMetricQuery({type: 'equation'}));

      const labels = assignSequentialLabels(queries);
      const equationIdx = queries.findIndex(q => {
        const vis = q.queryParams.visualizes[0];
        return vis && isVisualizeEquation(vis);
      });

      // Assign the labels to the queries so the state is in sync
      queries.forEach((q, index) => {
        q.label = labels[index];
      });

      const selectedLabel = equationIdx >= 0 ? labels[equationIdx] : labels[0];

      snapshot = {queries, selectedLabel};
      equationSnapshot.current = snapshot;
    }

    const selected =
      snapshot.queries.find(q => q.label === snapshot.selectedLabel) ??
      snapshot.queries[0];
    if (!selected) {
      return;
    }
    const yAxis = selected.queryParams.visualizes[0]?.yAxis;
    if (yAxis) {
      dispatchYAxisUpdate(
        yAxis,
        '', // Force the dispatch to fire
        state.displayType,
        state.fields,
        dispatch
      );
    }
    dispatch({
      type: BuilderStateAction.SET_QUERY,
      payload: [selected.queryParams.query],
    });
  }, [state.displayType, state.yAxis, state.fields, dispatch]);

  // Auto-restore the previous visualize mode when the dataset returns
  // to TRACEMETRICS. Detects equation yAxis on return and restores the
  // cached equation mode if the user was in equation mode when they left.
  useEffect(() => {
    if (state.dataset !== WidgetType.TRACEMETRICS || !hasEquations) {
      setIsEquationMode(false);
      return;
    }

    const aggregateSource = getTraceMetricAggregateSource(
      state.displayType,
      state.yAxis,
      state.fields
    );
    const hasEquationInYAxis = (aggregateSource ?? []).some(
      f => f.kind === FieldValueKind.EQUATION
    );

    if (hasEquationInYAxis) {
      setIsEquationMode(true);
    } else if (wasEquationModeOnLeave.current && equationSnapshot.current) {
      restoreEquationState();
      setIsEquationMode(true);
    }
    // Intentionally keyed on dataset only — we want this to fire
    // exactly when the user navigates back to TRACEMETRICS.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.dataset]);

  const handleModeToggle = useCallback(
    (nextIsEquation: boolean) => {
      if (nextIsEquation) {
        const currentFields = getTraceMetricAggregateSource(
          state.displayType,
          state.yAxis,
          state.fields
        );
        seriesSnapshot.current = {
          fields: currentFields ? structuredClone(currentFields) : [],
          query: state.query ? [...state.query] : [],
        };
        restoreEquationState();
      } else {
        restoreSeriesState();
      }

      wasEquationModeOnLeave.current = nextIsEquation;
      setIsEquationMode(nextIsEquation);
    },
    [
      state.displayType,
      state.yAxis,
      state.fields,
      state.query,
      restoreSeriesState,
      restoreEquationState,
    ]
  );

  return {isEquationMode, handleModeToggle, equationSnapshot};
}
