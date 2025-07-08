import {
  getAggregateArg,
  getMeasurementSlug,
  maybeEquationAlias,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function formatTimeSeriesName(timeSeries: TimeSeries): string {
  let {yAxis: seriesName} = timeSeries;
  // Decode from series name disambiguation
  seriesName = WidgetLegendNameEncoderDecoder.decodeSeriesNameForLegend(seriesName)!;

  // Check for special-case measurement formatting
  const arg = getAggregateArg(seriesName);
  if (arg) {
    const slug = getMeasurementSlug(arg);

    if (slug) {
      seriesName = slug.toUpperCase();
    }
  }

  // Strip equation prefix
  if (maybeEquationAlias(seriesName)) {
    seriesName = stripEquationPrefix(seriesName);
  }

  if (timeSeries.groupBy?.length && timeSeries.groupBy.length > 0) {
    seriesName += ` : ${timeSeries.groupBy
      ?.map(groupBy => {
        if (groupBy.key === 'release') {
          return formatVersion(groupBy.value);
        }

        return groupBy.value;
      })
      .join(',')}`;
  }

  return seriesName;
}
