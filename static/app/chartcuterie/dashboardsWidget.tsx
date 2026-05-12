import type {Theme} from '@emotion/react';

import {type Widget} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabelForWidgetQuery} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabelForWidgetQuery';
import {createPlottableFromTimeSeriesAndWidget} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/createPlottableFromTimeSeries';

import {buildTimeseriesChartOption, CHART_SIZE} from './timeseries';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

/**
 * a tuple of a TimeSeries and the index of the widget query that produced it
 */
export type WidgetQueryTimeSeries = [timeSeries: TimeSeries, widgetQueryIndex: number];

type ChartData = {
  timeSeries: WidgetQueryTimeSeries[];
  widget: Widget;
};

export const makeDashboardsWidgetCharts = (
  theme: Theme
): Array<RenderDescriptor<ChartType>> => [
  {
    key: ChartType.SLACK_DASHBOARDS_WIDGET,
    getOption: (data: ChartData) => {
      const queryIndexByTimeSeries = new Map<TimeSeries, number>(data.timeSeries);
      const flatTimeSeries = data.timeSeries.map(([ts]) => ts);

      return buildTimeseriesChartOption({
        theme,
        timeSeries: flatTimeSeries,
        createPlottable: (ts, {color}) => {
          const widgetQueryIndex = queryIndexByTimeSeries.get(ts) ?? 0;
          const widgetQuery =
            data.widget.queries[widgetQueryIndex] ?? data.widget.queries[0];
          const alias = widgetQuery
            ? formatTimeSeriesLabelForWidgetQuery(ts, data.widget, widgetQuery)
            : undefined;
          // Chartcuterie's Legend has no nameFormatter (unlike
          // timeSeriesWidgetVisualization), so the legend reads ECharts
          // series.name directly. Pass the alias as ``name`` too so the
          // widget-aware label actually surfaces in the rendered legend.
          return createPlottableFromTimeSeriesAndWidget(
            ts,
            data.widget,
            alias,
            alias,
            color
          );
        },
      });
    },
    ...CHART_SIZE,
  },
];
