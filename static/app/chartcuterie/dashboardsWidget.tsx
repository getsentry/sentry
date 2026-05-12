import type {Theme} from '@emotion/react';

import {defined} from 'sentry/utils';
import {type Widget} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';
import {formatTimeSeriesLabelForWidgetQuery} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabelForWidgetQuery';
import {createPlottableFromTimeSeriesAndWidget} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/createPlottableFromTimeSeries';
import type {Plottable} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/plottable';
import {Thresholds} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/thresholds';

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

      // Mirrors visualizationWidget.tsx — render the threshold mark areas /
      // lines when the widget has at least one threshold value set.
      const extraPlottables: Plottable[] = [];
      const {thresholds} = data.widget;
      if (
        thresholds &&
        (defined(thresholds.max_values.max1) || defined(thresholds.max_values.max2))
      ) {
        extraPlottables.push(
          new Thresholds({
            thresholds,
            dataType: flatTimeSeries[0]?.meta?.valueType,
          })
        );
      }

      return buildTimeseriesChartOption({
        theme,
        timeSeries: flatTimeSeries,
        extraPlottables,
        createPlottable: (ts, {color}) => {
          const widgetQueryIndex = queryIndexByTimeSeries.get(ts) ?? 0;
          const widgetQuery =
            data.widget.queries[widgetQueryIndex] ?? data.widget.queries[0];
          const alias = widgetQuery
            ? formatTimeSeriesLabelForWidgetQuery(ts, data.widget, widgetQuery)
            : formatTimeSeriesLabel(ts);
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
