import type {Series} from 'sentry/types/echarts';
import type {Widget} from 'sentry/views/dashboards/types';

const SERIES_NAME_DELIMITER = ';';

class WidgetLegendNameEncoderDecoder {
  static encodeSeriesNameForLegend(seriesName: string, widgetId?: string) {
    return `${seriesName}${SERIES_NAME_DELIMITER}${widgetId}`;
  }

  static decodeSeriesNameForLegend(encodedSeriesName: string) {
    return encodedSeriesName.split(SERIES_NAME_DELIMITER)[0];
  }

  // change timeseries names to SeriesName:widgetID
  static modifyTimeseriesNames(widget: Widget, timeseriesResults?: Series[]) {
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
  }
}

export default WidgetLegendNameEncoderDecoder;
