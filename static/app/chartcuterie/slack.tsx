import Grid from 'app/components/charts/components/grid';
import Legend from 'app/components/charts/components/legend';
import XAxis from 'app/components/charts/components/xAxis';
import YAxis from 'app/components/charts/components/yAxis';
import {lightTheme as theme} from 'app/utils/theme';

/**
 * Size configuration for SLACK_* type charts
 */
export const slackChartSize = {
  height: 150,
  width: 450,
};

export const slackGeoChartSize = {
  height: 200,
  width: 450,
};

/**
 * Default echarts option config for slack charts
 */
export const slackChartDefaults = {
  grid: Grid({left: 5, right: 5, bottom: 5}),
  backgroundColor: theme.background,
  legend: Legend({theme, itemHeight: 6, top: 2, right: 10}),
  yAxis: YAxis({theme, splitNumber: 3, axisLabel: {fontSize: 11}}),
  xAxis: XAxis({theme, nameGap: 5, isGroupedByDate: true, axisLabel: {fontSize: 11}}),
};
