import type {Series} from 'sentry/types/echarts';
import type {Widget} from 'sentry/views/dashboards/types';

const SERIES_NAME_DELIMITER = ';';

const WidgetLegendNameEncoderDecoder = {
  encodeSeriesNameForLegend(seriesName: string, widgetId?: string) {
    return `${seriesName}${SERIES_NAME_DELIMITER}${widgetId}`;
  },

  decodeSeriesNameForLegend(encodedSeriesName: string) {
    return encodedSeriesName.split(SERIES_NAME_DELIMITER)[0];
  },

  // change timeseries names to SeriesName:widgetID
  modifyTimeseriesNames(widget: Widget, timeseriesResults?: Series[]) {
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
