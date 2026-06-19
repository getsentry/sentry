import uniqBy from 'lodash/uniqBy';

import {explodeFieldString, type Column} from 'sentry/utils/discover/fields';
import type {DisplayType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {getTraceMetricAggregateActionType} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';
import {
  DEFAULT_YAXIS_BY_TYPE,
  RATE_AGGREGATES,
} from 'sentry/views/explore/metrics/constants';
import type {BaseMetricQuery} from 'sentry/views/explore/metrics/metricQuery';
import {updateVisualizeYAxis} from 'sentry/views/explore/metrics/utils';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

/**
 * Prepares series-mode metric queries for use in equation mode by replacing
 * rate aggregates with defaults and removing duplicates that result from
 * the replacement.
 */
export function prepareQueriesForEquationMode(
  queries: BaseMetricQuery[]
): BaseMetricQuery[] {
  const replaced = queries.map(query => {
    const visualizes = query.queryParams.visualizes;
    let changed = false;
    const newVisualizes = visualizes.map(visualize => {
      if (!isVisualizeFunction(visualize)) {
        return visualize;
      }
      const aggName = visualize.parsedFunction?.name;
      if (!aggName || !RATE_AGGREGATES.has(aggName)) {
        return visualize;
      }
      changed = true;
      const defaultAgg = DEFAULT_YAXIS_BY_TYPE[query.metric.type] ?? 'sum';
      return updateVisualizeYAxis(visualize, defaultAgg, query.metric);
    });

    if (!changed) {
      return query;
    }

    return {
      ...query,
      queryParams: query.queryParams.replace({
        aggregateFields: [
          ...newVisualizes,
          ...query.queryParams.aggregateFields.filter(isGroupBy),
        ],
      }),
    };
  });

  return uniqBy(replaced, query =>
    JSON.stringify(query.queryParams.visualizes.map(v => v.yAxis).sort())
  );
}

// Triggers a y-axis update using the correct action type based on the display type.
export function dispatchYAxisUpdate(
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
