import type {Theme} from '@emotion/react';
import type {LineSeriesOption, YAXisComponentOption} from 'echarts';

import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import XAxis from 'sentry/components/charts/components/xAxis';
import AreaSeries from 'sentry/components/charts/series/areaSeries';
import type {SessionApiResponse} from 'sentry/types/organization';
import {
  getMetricDetectorChartOption,
  transformSessionResponseToSeries,
  type MetricDetectorChartData,
} from 'sentry/views/detectors/components/details/metric/charts/metricDetectorChartOptions';

import {DEFAULT_FONT_FAMILY, makeSlackChartDefaults, slackChartSize} from './slack';
import type {RenderDescriptor} from './types';
import {ChartType} from './types';

function transformAreaSeries(series: AreaChartSeries[]): LineSeriesOption[] {
  return series.map(({seriesName, data, ...otherSeriesProps}) => {
    const areaSeries = AreaSeries({
      name: seriesName,
      data: data.map(({name, value}) => [name, value]),
      lineStyle: {
        opacity: 1,
        width: 0.4,
      },
      areaStyle: {
        opacity: 1.0,
      },
      animation: false,
      animationThreshold: 1,
      animationDuration: 0,
      ...otherSeriesProps,
    });

    // Fix incident label font family, cannot use Rubik
    if (areaSeries.markLine?.label) {
      areaSeries.markLine.label.fontFamily = DEFAULT_FONT_FAMILY;
    }

    return areaSeries;
  });
}

export function makeMetricDetectorCharts(
  theme: Theme
): Array<RenderDescriptor<ChartType>> {
  const slackChartDefaults = makeSlackChartDefaults(theme);
  const metricDetectorCharts: Array<RenderDescriptor<ChartType>> = [];

  const metricDetectorXaxis = XAxis({
    theme,
    splitNumber: 3,
    isGroupedByDate: true,
    axisLabel: {fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY},
  });
  const metricDetectorYaxis: YAXisComponentOption = {
    axisLabel: {fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY},
    splitLine: {
      lineStyle: {
        color: theme.colors.gray300,
        opacity: 0.3,
      },
    },
  };

  metricDetectorCharts.push({
    key: ChartType.SLACK_METRIC_DETECTOR_EVENTS,
    getOption: (data: MetricDetectorChartData) => {
      const {chartOption} = getMetricDetectorChartOption(data, theme);

      return {
        ...chartOption,
        backgroundColor: theme.tokens.background.primary,
        series: transformAreaSeries(chartOption.series),
        xAxis: metricDetectorXaxis,
        yAxis: {
          ...chartOption.yAxis,
          ...metricDetectorYaxis,
          axisLabel: {
            ...chartOption.yAxis!.axisLabel,
            ...metricDetectorYaxis.axisLabel,
          },
        },
        grid: slackChartDefaults.grid,
      };
    },
    ...slackChartSize,
  });

  interface MetricDetectorSessionData
    extends Omit<MetricDetectorChartData, 'timeseriesData'> {
    sessionResponse: SessionApiResponse;
  }

  metricDetectorCharts.push({
    key: ChartType.SLACK_METRIC_DETECTOR_SESSIONS,
    getOption: (data: MetricDetectorSessionData) => {
      const {sessionResponse, detector, ...rest} = data;
      const {chartOption} = getMetricDetectorChartOption(
        {
          ...rest,
          detector,
          timeseriesData: transformSessionResponseToSeries(sessionResponse, detector),
        },
        theme
      );

      return {
        ...chartOption,
        backgroundColor: theme.tokens.background.primary,
        series: transformAreaSeries(chartOption.series),
        xAxis: metricDetectorXaxis,
        yAxis: {
          ...chartOption.yAxis,
          ...metricDetectorYaxis,
          axisLabel: {
            ...chartOption.yAxis!.axisLabel,
            ...metricDetectorYaxis.axisLabel,
          },
        },
        grid: slackChartDefaults.grid,
      };
    },
    ...slackChartSize,
  });

  return metricDetectorCharts;
}
