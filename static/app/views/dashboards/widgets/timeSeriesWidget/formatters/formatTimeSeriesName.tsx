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
  // If the timeSeries has `groupBy` information, the label is made by
  // concatenating the values of the groupBy, since there's no point repeating
  // the name of the Y axis multiple times in the legend.
  if (timeSeries.groupBy?.length && timeSeries.groupBy.length > 0) {
    return `${timeSeries.groupBy
      ?.map(groupBy => {
        if (groupBy.key === 'release') {
          return formatVersion(groupBy.value);
        }

        return groupBy.value;
      })
      .join(',')}`;
  }

  let {yAxis: seriesName} = timeSeries;

  // Decode from series name disambiguation
  seriesName = WidgetLegendNameEncoderDecoder.decodeSeriesNameForLegend(seriesName)!;

  // Attempt to parse the `seriesName` as a version. A correct `TimeSeries`
  // would have a `yAxis` like `p50(span.duration)` with a `groupBy` like
  // `[{key: "release", value: "proj@1.2.3"}]`. `groupBy` was only introduced
  // recently though, so many `TimeSeries` instead mash the group by information
  // into the `yAxis` property, e.g., the `yAxis` might have been set to
  // `"proj@1.2.3"` just to get the correct rendering in the chart legend. We
  // cover these cases by parsing the `yAxis` as a series name. This works badly
  // because sometimes it'll interpet email addresses as versions, which causes
  // bugs. We should update all usages of `TimeSeriesWidgetVisualization` to
  // correctly specify `yAxis` and `groupBy`, and/or to use the time
  // `/events-timeseries` endpoint which does this automatically.
  seriesName = formatVersion(seriesName);

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

  return seriesName;
}
