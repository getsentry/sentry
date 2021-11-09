import {EChartOption} from 'echarts';
import isArray from 'lodash/isArray';
import max from 'lodash/max';

import XAxis from 'app/components/charts/components/xAxis';
import AreaSeries from 'app/components/charts/series/areaSeries';
import BarSeries from 'app/components/charts/series/barSeries';
import LineSeries from 'app/components/charts/series/lineSeries';
import MapSeries from 'app/components/charts/series/mapSeries';
import {lightenHexToRgb} from 'app/components/charts/utils';
import * as countryCodesMap from 'app/data/countryCodesMap';
import {t} from 'app/locale';
import {EventsGeoData, EventsStats} from 'app/types';
import {lightTheme as theme} from 'app/utils/theme';

import {slackChartDefaults, slackChartSize, slackGeoChartSize} from './slack';
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
  getOption: (
    data:
      | {seriesName: string; stats: EventsStats}
      | {seriesName?: string; stats: Record<string, EventsStats>}
  ) => {
    if (isArray(data.stats.data)) {
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
    }

    const stats = Object.keys(data.stats).map(key =>
      Object.assign({}, {key}, data.stats[key])
    );
    const color = theme.charts.getColorPalette(stats.length - 2);

    const series = stats
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s, i) =>
        AreaSeries({
          name: s.key,
          stack: 'area',
          data: s.data.map(([timestamp, countsForTimestamp]) => [
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
  key: ChartType.SLACK_DISCOVER_TOTAL_DAILY,
  getOption: (
    data:
      | {seriesName: string; stats: EventsStats}
      | {seriesName?: string; stats: Record<string, EventsStats>}
  ) => {
    if (isArray(data.stats.data)) {
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
    }

    const stats = Object.keys(data.stats).map(key =>
      Object.assign({}, {key}, data.stats[key])
    );
    const color = theme.charts.getColorPalette(stats.length - 2);

    const series = stats
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s, i) =>
        BarSeries({
          name: s.key,
          stack: 'area',
          data: s.data.map(([timestamp, countsForTimestamp]) => ({
            value: [
              timestamp * 1000,
              countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
            ],
          })),
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

discoverCharts.push({
  key: ChartType.SLACK_DISCOVER_TOP5_PERIOD,
  getOption: (
    data: {stats: Record<string, EventsStats>} | {seriesName?: string; stats: EventsStats}
  ) => {
    if (isArray(data.stats.data)) {
      const color = theme.charts.getColorPalette(data.stats.data.length - 2);

      const areaSeries = AreaSeries({
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
    }

    const stats = Object.values(data.stats);
    const hasOther = Object.keys(data.stats).includes('Other');
    const color = theme.charts.getColorPalette(stats.length - 2 - (hasOther ? 1 : 0));
    if (hasOther) {
      color.push(theme.chartOther);
    }

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
  key: ChartType.SLACK_DISCOVER_TOP5_PERIOD_LINE,
  getOption: (
    data: {stats: Record<string, EventsStats>} | {seriesName?: string; stats: EventsStats}
  ) => {
    if (isArray(data.stats.data)) {
      const color = theme.charts.getColorPalette(data.stats.data.length - 2);

      const lineSeries = LineSeries({
        data: data.stats.data.map(([timestamp, countsForTimestamp]) => [
          timestamp * 1000,
          countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
        ]),
        lineStyle: {color: color?.[0], opacity: 1},
        itemStyle: {color: color?.[0]},
      });

      return {
        ...slackChartDefaults,
        useUTC: true,
        color,
        series: [lineSeries],
      };
    }

    const stats = Object.values(data.stats);
    const hasOther = Object.keys(data.stats).includes('Other');
    const color = theme.charts.getColorPalette(stats.length - 2 - (hasOther ? 1 : 0));
    if (hasOther) {
      color.push(theme.chartOther);
    }

    const series = stats
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((topSeries, i) =>
        LineSeries({
          data: topSeries.data.map(([timestamp, countsForTimestamp]) => [
            timestamp * 1000,
            countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
          ]),
          lineStyle: {color: color?.[i], opacity: 1},
          itemStyle: {color: color?.[i]},
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
  getOption: (
    data: {stats: Record<string, EventsStats>} | {seriesName?: string; stats: EventsStats}
  ) => {
    if (isArray(data.stats.data)) {
      const color = theme.charts.getColorPalette(data.stats.data.length - 2);

      const areaSeries = AreaSeries({
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
    }

    const stats = Object.values(data.stats);
    const hasOther = Object.keys(data.stats).includes('Other');
    const color = theme.charts.getColorPalette(stats.length - 2 - (hasOther ? 1 : 0));
    if (hasOther) {
      color.push(theme.chartOther);
    }

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

discoverCharts.push({
  key: ChartType.SLACK_DISCOVER_PREVIOUS_PERIOD,
  getOption: (
    data:
      | {seriesName: string; stats: EventsStats}
      | {seriesName?: string; stats: Record<string, EventsStats>}
  ) => {
    if (isArray(data.stats.data)) {
      const dataMiddleIndex = Math.floor(data.stats.data.length / 2);
      const current = data.stats.data.slice(dataMiddleIndex);
      const previous = data.stats.data.slice(0, dataMiddleIndex);
      const color = theme.charts.getColorPalette(data.stats.data.length - 2);
      const areaSeries = AreaSeries({
        name: data.seriesName,
        data: current.map(([timestamp, countsForTimestamp]) => [
          timestamp * 1000,
          countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
        ]),
        lineStyle: {color: color?.[0], opacity: 1, width: 0.4},
        areaStyle: {color: color?.[0], opacity: 1},
      });

      const previousPeriod = LineSeries({
        name: t('previous %s', data.seriesName),
        data: previous.map(([_, countsForTimestamp], i) => [
          current[i][0] * 1000,
          countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
        ]),
        lineStyle: {color: theme.gray200, type: 'dotted'},
        itemStyle: {color: theme.gray200},
      });

      return {
        ...slackChartDefaults,
        useUTC: true,
        color,
        series: [areaSeries, previousPeriod],
      };
    }

    const stats = Object.keys(data.stats).map(key =>
      Object.assign({}, {key}, data.stats[key])
    );
    const color = theme.charts.getColorPalette(stats.length - 2);
    const previousPeriodColor = lightenHexToRgb(color);

    const areaSeries: EChartOption.SeriesLine[] = [];
    const lineSeries: EChartOption.SeriesLine[] = [];

    stats
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((s, i) => {
        const dataMiddleIndex = Math.floor(s.data.length / 2);
        const current = s.data.slice(dataMiddleIndex);
        const previous = s.data.slice(0, dataMiddleIndex);
        areaSeries.push(
          AreaSeries({
            name: s.key,
            stack: 'area',
            data: s.data
              .slice(dataMiddleIndex)
              .map(([timestamp, countsForTimestamp]) => [
                timestamp * 1000,
                countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
              ]),
            lineStyle: {color: color?.[i], opacity: 1, width: 0.4},
            areaStyle: {color: color?.[i], opacity: 1},
          })
        );
        lineSeries.push(
          LineSeries({
            name: t('previous %s', s.key),
            stack: 'previous',
            data: previous.map(([_, countsForTimestamp], index) => [
              current[index][0] * 1000,
              countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
            ]),
            lineStyle: {color: previousPeriodColor?.[i], type: 'dotted'},
            itemStyle: {color: previousPeriodColor?.[i]},
          })
        );
      });

    return {
      ...slackChartDefaults,
      xAxis: discoverxAxis,
      useUTC: true,
      color,
      series: [...areaSeries, ...lineSeries],
    };
  },
  ...slackChartSize,
});

discoverCharts.push({
  key: ChartType.SLACK_DISCOVER_WORLDMAP,
  getOption: (data: {seriesName: string; stats: {data: EventsGeoData}}) => {
    const mapSeries = MapSeries({
      map: 'sentryWorld',
      name: data.seriesName,
      data: data.stats.data.map(country => ({
        name: country['geo.country_code'],
        value: country.count,
      })),
      nameMap: countryCodesMap.default,
      aspectScale: 0.85,
      zoom: 1.1,
      center: [10.97, 9.71],
      itemStyle: {
        areaColor: theme.gray200,
        borderColor: theme.backgroundSecondary,
      } as any, // TODO(ts): Echarts types aren't correct for these colors as they don't allow for basic strings
    });

    // For absolute values, we want min/max to based on min/max of series
    // Otherwise it should be 0-100
    const maxValue = max(data.stats.data.map(value => value.count)) || 1;

    return {
      backgroundColor: theme.background,
      visualMap: [
        {
          left: 'right',
          min: 0,
          max: maxValue,
          inRange: {
            color: [theme.purple200, theme.purple300],
          },
          text: ['High', 'Low'],
          textStyle: {
            color: theme.textColor,
          },

          // Whether show handles, which can be dragged to adjust "selected range".
          // False because the handles are pretty ugly
          calculable: false,
        },
      ],
      series: [mapSeries],
    };
  },
  ...slackGeoChartSize,
});
