import type {Series} from 'sentry/types/echarts';
import {
  AGGREGATE_BASE,
  parseFunction,
  prettifyParsedFunction,
} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';

const SERIES_NAME_DELIMITER = '|~|';

const WidgetLegendNameEncoderDecoder = {
  encodeSeriesNameForLegend(seriesName: string, widgetId?: string) {
    return `${seriesName}${SERIES_NAME_DELIMITER}${widgetId}`;
  },

  decodeSeriesNameForLegend(encodedSeriesName: string, skipPrettify = false) {
    let seriesName = encodedSeriesName.split(SERIES_NAME_DELIMITER)[0];
    if (!seriesName) {
      return '';
    }

    // If the series name contains an aggregate function, prettify it
    const functionMatch = seriesName.match(AGGREGATE_BASE);
    if (!skipPrettify && functionMatch?.[0] && parseFunction(functionMatch[0])) {
      seriesName = seriesName.replace(
        functionMatch[0],
        prettifyParsedFunction(parseFunction(functionMatch[0])!)
      );
    }

    return seriesName;
  },

  // change timeseries names to SeriesName:widgetID
  modifyTimeseriesNames(
    widget: Widget,
    timeseriesResults?: Series[]
  ): Series[] | undefined {
    if (!timeseriesResults) {
      return undefined;
    }

    return timeseriesResults
      ? timeseriesResults.map(series => {
          return {
            ...series,
            seriesName: this.encodeSeriesNameForLegend(series.seriesName, widget.id),
          };
        })
      : [];
  },
};

export default WidgetLegendNameEncoderDecoder;
