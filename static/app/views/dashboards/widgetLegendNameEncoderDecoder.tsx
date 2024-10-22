import type {Series} from 'sentry/types/echarts';
import type {Widget} from 'sentry/views/dashboards/types';

class WidgetLegendNameEncoderDecoder {
  static encodeSeriesNameForLegend(seriesName: string, widgetId?: string) {
    return `${seriesName}:${widgetId}`;
  }

  static decodeSeriesNameForLegend(encodedSeriesName: string) {
    return encodedSeriesName.split(':')[0];
  }

  // change timeseries names to SeriesName:widgetID
  static modifyTimeseriesNames(widget: Widget, timeseriesResults?: Series[]) {
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
