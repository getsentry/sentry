import isEqual from 'lodash/isEqual';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function getTimeSeriesForQuery(
  data: Record<string, TimeSeries[]>,
  yAxis: string,
  transformations: readonly string[] = []
): TimeSeries[] {
  return (data[yAxis] ?? []).filter(
    series =>
      series.requestedTransformations === undefined ||
      isEqual(series.requestedTransformations, transformations)
  );
}
