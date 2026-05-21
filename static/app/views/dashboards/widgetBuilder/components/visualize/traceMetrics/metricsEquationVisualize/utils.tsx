import {explodeFieldString, type Column} from 'sentry/utils/discover/fields';
import type {DisplayType} from 'sentry/views/dashboards/types';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {getTraceMetricAggregateActionType} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {FieldValueKind} from 'sentry/views/discover/table/types';

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
