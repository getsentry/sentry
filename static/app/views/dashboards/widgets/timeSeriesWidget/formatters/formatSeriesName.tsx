import {
  getAggregateArg,
  getMeasurementSlug,
  maybeEquationAlias,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';
import {formatVersion} from 'sentry/utils/versions/formatVersion';

import WidgetLegendNameEncoderDecoder from '../../../widgetLegendNameEncoderDecoder';

export function formatSeriesName(seriesName: string): string {
  // Decode from series name disambiguation
  seriesName = WidgetLegendNameEncoderDecoder.decodeSeriesNameForLegend(seriesName)!;

  // Check if it's a release version
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
