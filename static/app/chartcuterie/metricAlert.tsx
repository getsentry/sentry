import type {LineSeriesOption, YAXisComponentOption} from 'echarts';

import type {AreaChartSeries} from 'sentry/components/charts/areaChart';
import XAxis from 'sentry/components/charts/components/xAxis';
import AreaSeries from 'sentry/components/charts/series/areaSeries';
import type {SessionApiResponse} from 'sentry/types';
import {lightTheme as theme} from 'sentry/utils/theme';
import {
  getMetricAlertChartOption,
  MetricChartData,
  transformSessionResponseToSeries,
} from 'sentry/views/alerts/rules/metric/details/metricChartOption';

import {DEFAULT_FONT_FAMILY, slackChartDefaults, slackChartSize} from './slack';
import {ChartType, RenderDescriptor} from './types';

const metricAlertXaxis = XAxis({
  theme,
  splitNumber: 3,
  isGroupedByDate: true,
  axisLabel: {fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY},
});
const metricAlertYaxis: YAXisComponentOption = {
  axisLabel: {fontSize: 11, fontFamily: DEFAULT_FONT_FAMILY},
  splitLine: {
    lineStyle: {
      color: theme.chartLineColor,
      opacity: 0.3,
    },
  },
};

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

export const metricAlertCharts: RenderDescriptor<ChartType>[] = [];

metricAlertCharts.push({
  key: ChartType.SLACK_METRIC_ALERT_EVENTS,
  getOption: (data: MetricChartData) => {
    const {chartOption} = getMetricAlertChartOption(data);

    return {
      ...chartOption,
      backgroundColor: theme.background,
      series: transformAreaSeries(chartOption.series),
      xAxis: metricAlertXaxis,
      yAxis: {
        ...chartOption.yAxis,
        ...metricAlertYaxis,
        axisLabel: {
          ...chartOption.yAxis!.axisLabel,
          ...metricAlertYaxis.axisLabel,
        },
      },
      grid: slackChartDefaults.grid,
    };
  },
  ...slackChartSize,
});

interface MetricAlertSessionData extends Omit<MetricChartData, 'timeseriesData'> {
  sessionResponse: SessionApiResponse;
}

metricAlertCharts.push({
  key: ChartType.SLACK_METRIC_ALERT_SESSIONS,
  getOption: (data: MetricAlertSessionData) => {
    const {sessionResponse, rule, ...rest} = data;
    const {chartOption} = getMetricAlertChartOption({
      ...rest,
      rule,
      timeseriesData: transformSessionResponseToSeries(sessionResponse, rule),
    });

    return {
      ...chartOption,
      backgroundColor: theme.background,
      series: transformAreaSeries(chartOption.series),
      xAxis: metricAlertXaxis,
      yAxis: {
        ...chartOption.yAxis,
        ...metricAlertYaxis,
        axisLabel: {
          ...chartOption.yAxis!.axisLabel,
          ...metricAlertYaxis.axisLabel,
        },
      },
      grid: slackChartDefaults.grid,
    };
  },
  ...slackChartSize,
});
