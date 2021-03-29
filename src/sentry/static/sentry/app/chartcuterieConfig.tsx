/* global process */

/**
 * This module is used to define the look and feels for charts rendered via the
 * backend chart rendering service Chartcuterie.
 *
 * Be careful what you import into this file, as it will end up being bundled
 * into the configuration file loaded by the service.
 */

import Grid from 'app/components/charts/components/grid';
import Legend from 'app/components/charts/components/legend';
import XAxis from 'app/components/charts/components/xAxis';
import YAxis from 'app/components/charts/components/yAxis';
import AreaSeries from 'app/components/charts/series/areaSeries';
import {getColorPalette} from 'app/components/charts/utils';
import {EventsStatsData} from 'app/types';
import type {
  ChartcuterieConfig,
  RenderConfig,
  RenderDescriptor,
} from 'app/types/chartcuterie';
import {lightTheme as theme} from 'app/utils/theme';

/**
 * Defines the keys which may be passed into the chartcuterie chart rendering
 * service.
 *
 * When adding or removing from this list, please also update the
 * sentry/charts/types.py file
 */
export enum ChartType {
  SLACK_DISCOVER_TOTAL_PERIOD = 'slack:discover.totalPeriod',
}

/**
 * All registered style descriptors
 */
const renderConfig: RenderConfig<ChartType> = new Map();

/**
 * Register a style descriptor
 */
const register = (renderDescriptor: RenderDescriptor<ChartType>) =>
  renderConfig.set(renderDescriptor.key, renderDescriptor);

/**
 * Slack unfurls for discover using the Total Period view
 */
register({
  key: ChartType.SLACK_DISCOVER_TOTAL_PERIOD,
  height: 150,
  width: 450,
  getOption: (data: {seriesName: string; series: EventsStatsData}) => {
    const color = getColorPalette(theme, data.series.length);

    const series = data.series.map(([timestamp, countsForTimestamp]) => ({
      name: timestamp * 1000,
      value: countsForTimestamp.reduce((acc, {count}) => acc + count, 0),
    }));

    return {
      useUTC: true,
      color,
      backgroundColor: theme.background,
      grid: Grid({left: 5, right: 5, bottom: 5}),
      legend: Legend({theme, itemHeight: 6, top: 2, right: 10}),
      yAxis: YAxis({
        theme,
        splitNumber: 3,
        axisLabel: {fontSize: 11},
      }),
      xAxis: XAxis({
        theme,
        isGroupedByDate: true,
        axisLabel: {fontSize: 11},
      }),
      series: [
        AreaSeries({
          name: data.seriesName,
          data: series.map(({name, value}) => [name, value]),
          lineStyle: {
            color: color?.[0],
            opacity: 1,
            width: 0.4,
          },
          areaStyle: {
            color: color?.[0],
            opacity: 1.0,
          },
        }),
      ],
    };
  },
});

const config: ChartcuterieConfig = {
  version: process.env.COMMIT_SHA!,
  renderConfig,
};

export default config;
