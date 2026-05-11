import type {Theme} from '@emotion/react';

import {type Widget} from 'sentry/views/dashboards/types';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabelForWidgetQuery} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabelForWidgetQuery';
import {createPlottableFromTimeSeriesAndWidget} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/createPlottableFromTimeSeries';

import {buildTimeseriesChartOption, CHART_SIZE} from './timeseries';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

/**
 * One ``TimeSeries`` paired with the index of the widget query that produced
 * it. A single widget query can yield multiple ``TimeSeries`` (multi-aggregate
 * queries, ``yAxis=[...]``, grouped queries with ``topEvents``), so we can't
 * just zip ``timeSeries`` against ``widget.queries`` positionally. The
 * backend already has the pairing for free at request time (one HTTP call
 * per widget query), so it tags each series with its query index here.
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
      // ``buildTimeseriesChartOption`` works on flat ``TimeSeries[]`` (and
      // re-sorts grouped series internally), so we look up the query index
      // by TimeSeries identity rather than relying on positional index.
      const queryIndexByTimeSeries = new Map<TimeSeries, number>(data.timeSeries);
      const flatTimeSeries = data.timeSeries.map(([ts]) => ts);

      return buildTimeseriesChartOption({
        theme,
        timeSeries: flatTimeSeries,
        createPlottable: (ts, {color}) => {
          const widgetQueryIndex = queryIndexByTimeSeries.get(ts) ?? 0;
          const widgetQuery =
            data.widget.queries[widgetQueryIndex] ?? data.widget.queries[0];
          // ``alias`` flows into the plottable's ``label`` getter, which the
          // legend and tooltip read from — the same path
          // ``visualizationWidget`` uses for its own legend labels.
          const alias = widgetQuery
            ? formatTimeSeriesLabelForWidgetQuery(ts, data.widget, widgetQuery)
            : undefined;
          return createPlottableFromTimeSeriesAndWidget(
            ts,
            data.widget,
            alias,
            undefined,
            color
          );
        },
      });
    },
    ...CHART_SIZE,
  },
];
