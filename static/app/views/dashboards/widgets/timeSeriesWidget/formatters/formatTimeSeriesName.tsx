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
  // If the timeSeries has `groupBy` information, don't bother including the Y
  // axis name, just format the groupBy by concatenating the values. This is the
  // most common desired behavior.
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

  // Check if it's a release version. NOTE: This is not a good idea.
  // `formatVersion` will aggressively assume that any `@` symbol in the string
  // signifies a version, so user emails will be formatted as versions. All
  // usage of `TimeSeriesWidgetVisualization` should be careful about using the
  // `groupBy` property of a `TimeSeries`, because it'll _only parse the release
  // tag_ as a version, and leave others alone. Once `groupBy` is in wide use,
  // we can remove this parsing.
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
