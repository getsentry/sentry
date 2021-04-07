import XAxis from 'app/components/charts/components/xAxis';
import AreaSeries from 'app/components/charts/series/areaSeries';
import BarSeries from 'app/components/charts/series/barSeries';
import {EventsStats} from 'app/types';
import {lightTheme as theme} from 'app/utils/theme';

import {slackChartDefaults, slackChartSize} from './slack';
import {ChartType, RenderDescriptor} from './types';

const discoverxAxis = XAxis({
  theme,
  boundaryGap: true,
  splitNumber: 3,
  isGroupedByDate: true,
  axisLabel: {fontSize: 11},
});

export const discoverCharts: RenderDescriptor<ChartType>[] = [];

discoverCharts.push({
  key: ChartType.SLACK_DISCOVER_TOTAL_PERIOD,
  getOption: (data: {seriesName: string; stats: EventsStats}) => {
    const color = theme.charts.getColorPalette(data.stats.data.length - 2);

    const areaSeries = AreaSeries({
      name: data.seriesName,
      data: data.stats.data.map(([timestamp, countsForTimestamp]) => [
        timestamp * 1000,
        countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
      ]),
      lineStyle: {color: color?.[0], opacity: 1, width: 0.4},
      areaStyle: {color: color?.[0], opacity: 1},
    });

    return {
      ...slackChartDefaults,
      useUTC: true,
      color,
      series: [areaSeries],
    };
  },
  ...slackChartSize,
});

discoverCharts.push({
  key: ChartType.SLACK_DISCOVER_TOTAL_DAILY,
  getOption: (data: {seriesName: string; stats: EventsStats}) => {
    const color = theme.charts.getColorPalette(data.stats.data.length - 2);

    const barSeries = BarSeries({
      name: data.seriesName,
      data: data.stats.data.map(([timestamp, countsForTimestamp]) => ({
        value: [
          timestamp * 1000,
          countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
        ],
      })),
      itemStyle: {color: color?.[0], opacity: 1},
    });

    return {
      ...slackChartDefaults,
      xAxis: discoverxAxis,
      useUTC: true,
      color,
      series: [barSeries],
    };
  },
  ...slackChartSize,
});

discoverCharts.push({
  key: ChartType.SLACK_DISCOVER_TOP5_PERIOD,
  getOption: (data: {stats: Record<string, EventsStats>}) => {
    const stats = Object.values(data.stats);
    const color = theme.charts.getColorPalette(stats.length - 2);

    const series = stats
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((topSeries, i) =>
        AreaSeries({
          stack: 'area',
          data: topSeries.data.map(([timestamp, countsForTimestamp]) => [
            timestamp * 1000,
            countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
          ]),
          lineStyle: {color: color?.[i], opacity: 1, width: 0.4},
          areaStyle: {color: color?.[i], opacity: 1},
        })
      );

    return {
      ...slackChartDefaults,
      xAxis: discoverxAxis,
      useUTC: true,
      color,
      series,
    };
  },
  ...slackChartSize,
});

discoverCharts.push({
  key: ChartType.SLACK_DISCOVER_TOP5_DAILY,
  getOption: (data: {stats: Record<string, EventsStats>}) => {
    const stats = Object.values(data.stats);
    const color = theme.charts.getColorPalette(stats.length - 2);

    const series = stats
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((topSeries, i) =>
        BarSeries({
          stack: 'area',
          data: topSeries.data.map(([timestamp, countsForTimestamp]) => [
            timestamp * 1000,
            countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
          ]),
          itemStyle: {color: color?.[i], opacity: 1},
        })
      );

    return {
      ...slackChartDefaults,
      xAxis: discoverxAxis,
      useUTC: true,
      color,
      series,
    };
  },
  ...slackChartSize,
});
