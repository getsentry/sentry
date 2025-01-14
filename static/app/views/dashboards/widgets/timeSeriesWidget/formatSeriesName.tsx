import {
  getAggregateArg,
  getMeasurementSlug,
  maybeEquationAlias,
  stripEquationPrefix,
} from 'sentry/utils/discover/fields';

import WidgetLegendNameEncoderDecoder from '../../widgetLegendNameEncoderDecoder';

export function formatSeriesName(seriesName: string): string {
  seriesName = WidgetLegendNameEncoderDecoder.decodeSeriesNameForLegend(seriesName)!;

  const arg = getAggregateArg(seriesName);
  if (arg) {
    const slug = getMeasurementSlug(arg);

    if (slug) {
      seriesName = slug.toUpperCase();
    }
  }

  if (maybeEquationAlias(seriesName)) {
    seriesName = stripEquationPrefix(seriesName);
  }

  return seriesName;
}
