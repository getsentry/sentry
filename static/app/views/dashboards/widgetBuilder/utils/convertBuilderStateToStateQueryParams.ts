import omit from 'lodash/omit';

import {WidgetType} from 'sentry/views/dashboards/types';
import {
  serializeFields,
  serializeLinkedDashboards,
  serializeSorts,
  serializeThresholds,
  WIDGET_BUILDER_SESSION_STORAGE_KEY_MAP,
  type WidgetBuilderState,
  type WidgetBuilderStateQueryParams,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

export function convertBuilderStateToStateQueryParams(
  state: WidgetBuilderState
): WidgetBuilderStateQueryParams {
  const {fields, yAxis, sort, thresholds, linkedDashboards, ...rest} = state;
  const allowedRemainingParams = omit(
    rest,
    // all state params that use session storage instead of url query params
    Object.keys(WIDGET_BUILDER_SESSION_STORAGE_KEY_MAP)
  );
  return {
    ...allowedRemainingParams,
    field: serializeFields(fields ?? []),
    yAxis: serializeFields(yAxis ?? []),
    sort: serializeSorts(WidgetType.SPANS)(sort ?? []),
    thresholds: thresholds ? serializeThresholds(thresholds) : undefined,
    linkedDashboards: linkedDashboards
      ? serializeLinkedDashboards(linkedDashboards)
      : undefined,
  };
}
