import omit from 'lodash/omit';

import {WidgetType} from 'sentry/views/dashboards/types';
import {
  WIDGET_BUILDER_SESSION_STORAGE_KEY_MAP,
  type WidgetBuilderState,
  type WidgetBuilderStateQueryParams,
} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';

import {
  serializeFields,
  serializeLinkedDashboards,
  serializeSorts,
  serializeThresholds,
} from './serialization.ts';

export function convertBuilderStateToStateQueryParams(
  state: WidgetBuilderState
): WidgetBuilderStateQueryParams {
  const {fields, yAxis, sort, thresholds, linkedDashboards, transformations, ...rest} =
    state;
  const allowedRemainingParams = omit(
    rest,
    // all state params that use session storage instead of url query params
    Object.keys(WIDGET_BUILDER_SESSION_STORAGE_KEY_MAP)
  );
  return {
    ...allowedRemainingParams,
    field: serializeFields(fields ?? []),
    yAxis: serializeFields(yAxis ?? []),
    ...(transformations && {transformations: JSON.stringify(transformations)}),
    sort: serializeSorts(WidgetType.SPANS)(sort ?? []),
    thresholds: thresholds ? serializeThresholds(thresholds) : undefined,
    linkedDashboards: linkedDashboards
      ? serializeLinkedDashboards(linkedDashboards)
      : undefined,
  };
}
