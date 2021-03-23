import React from 'react';
import Color from 'color';
import {EChartOption} from 'echarts';
import {withTheme} from 'emotion-theming';

import BaseChart from 'app/components/charts/baseChart';
import Legend from 'app/components/charts/components/legend';
import Tooltip from 'app/components/charts/components/tooltip';
import xAxis from 'app/components/charts/components/xAxis';
import barSeries from 'app/components/charts/series/barSeries';
import {ChartContainer, HeaderTitleLegend} from 'app/components/charts/styles';
import Panel from 'app/components/panels/panel';
import ChartPalette from 'app/constants/chartPalette';
import {t} from 'app/locale';
import {DataCategory, SelectValue} from 'app/types';
import {formatAbbreviatedNumber} from 'app/utils/formatters';
import commonTheme, {Theme} from 'app/utils/theme';

import {formatUsageWithUnits, GIGABYTE} from '../utils';

import {getDateRange, getTooltipFormatter} from './utils';

const COLOR_ERRORS = ChartPalette[4][3];
const COLOR_ERRORS_DROPPED = Color(COLOR_ERRORS).lighten(0.25).string();

const COLOR_TRANSACTIONS = ChartPalette[4][2];
const COLOR_TRANSACTIONS_DROPPED = Color(COLOR_TRANSACTIONS).lighten(0.25).string();

const COLOR_ATTACHMENTS = ChartPalette[4][1];
const COLOR_ATTACHMENTS_DROPPED = Color(COLOR_ATTACHMENTS).lighten(0.5).string();
const COLOR_PROJECTED = commonTheme.gray200;

export const CHART_OPTIONS_DATACATEGORY: SelectValue<DataCategory>[] = [
  {
    label: 'Errors',
    value: DataCategory.ERRORS,
    disabled: false,
  },
  {
    label: 'Transactions',
    value: DataCategory.TRANSACTIONS,
    disabled: false,
  },
  {
    label: 'Attachments',
    value: DataCategory.ATTACHMENTS,
    disabled: false,
  },
];

export enum ChartDataTransform {
  CUMULATIVE = 'cumulative',
  DAILY = 'daily',
}

export const CHART_OPTIONS_DATA_TRANSFORM: SelectValue<ChartDataTransform>[] = [
  {
    label: 'Cumulative',
    value: ChartDataTransform.CUMULATIVE,
    disabled: false,
  },
  {
    label: 'Day-to-Day',
    value: ChartDataTransform.DAILY,
    disabled: false,
  },
];

export enum SeriesTypes {
  ACCEPTED = 'Accepted',
  DROPPED = 'Dropped',
  PROJECTED = 'Projected',
}

type Props = {
  theme: Theme;

  title?: React.ReactNode;
  footer?: React.ReactNode;

  dataCategory: DataCategory;
  dataTransform: ChartDataTransform;

  /**
   * If the parent component will handle data rolling up between cumulative
   * or daily, then UsageChart will skip the transformation
   */
  skipDataTransform: boolean;

  usageDateStart: string;
  usageDateEnd: string;
  usageStats: ChartStats;

  /**
   * Additional data to draw on the chart alongside usage
   */
  chartSeries?: EChartOption.Series[];

  /**
   * Replace default tooltip
   */
  chartTooltip?: EChartOption.Tooltip;
};

type State = {
  xAxisDates: string[];
};

export type ChartStats = {
  accepted: NonNullable<EChartOption.SeriesBar['data']>;
  dropped: NonNullable<EChartOption.SeriesBar['data']>;
  projected: NonNullable<EChartOption.SeriesBar['data']>;
};

export class UsageChart extends React.Component<Props, State> {
  static defaultProps: Partial<Props> = {
    skipDataTransform: false,
  };

  state: State = {
    xAxisDates: [],
  };

  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    const {usageDateStart, usageDateEnd} = nextProps;
    const xAxisDates = getDateRange(usageDateStart, usageDateEnd);

    return {
      ...prevState,
      xAxisDates,
    };
  }

  get chartColors() {
    const {dataCategory} = this.props;

    if (dataCategory === DataCategory.ERRORS) {
      return [COLOR_ERRORS, COLOR_ERRORS_DROPPED, COLOR_PROJECTED];
    }

    if (dataCategory === DataCategory.ATTACHMENTS) {
      return [COLOR_ATTACHMENTS, COLOR_ATTACHMENTS_DROPPED, COLOR_PROJECTED];
    }

    return [COLOR_TRANSACTIONS, COLOR_TRANSACTIONS_DROPPED, COLOR_PROJECTED];
  }

  get chartMetadata() {
    const {usageStats, dataCategory, dataTransform, skipDataTransform} = this.props;
    const {xAxisDates} = this.state;

    const display = CHART_OPTIONS_DATACATEGORY.find(o => o.value === dataCategory);
    if (!display) {
      throw new Error('Selected item is not supported');
    }

    const chartData: ChartStats = {
      accepted: [],
      dropped: [],
      projected: [],
    };

    const isCumulative =
      !skipDataTransform && dataTransform === ChartDataTransform.CUMULATIVE;

    Object.keys(usageStats).forEach(k => {
      const isProjected = k === SeriesTypes.PROJECTED;
      let count = 0;

      chartData[k] = usageStats[k].map(stat => {
        const [x, y] = stat.value;
        count = isCumulative ? count + y : y;

        return {
          ...stat,
          value: [x, count],
          tooltip: {show: false},
          itemStyle: {opacity: isProjected ? 0.6 : 1},
        };
      });
    });

    const {label, value} = display;

    if (value === DataCategory.ERRORS || value === DataCategory.TRANSACTIONS) {
      return {
        chartLabel: label,
        chartData,
        xAxisData: xAxisDates,
        yAxisMinInterval: 1000,
        yAxisFormatter: formatAbbreviatedNumber,
        tooltipValueFormatter: getTooltipFormatter(dataCategory),
      };
    }

    return {
      chartLabel: label,
      chartData,
      xAxisData: xAxisDates,
      yAxisMinInterval: 1 * GIGABYTE,
      yAxisFormatter: (val: number) =>
        formatUsageWithUnits(val, DataCategory.ATTACHMENTS, {
          isAbbreviated: true,
          useUnitScaling: true,
        }),
      tooltipValueFormatter: getTooltipFormatter(dataCategory),
    };
  }

  get chartSeries() {
    const {chartSeries} = this.props;
    const {chartData} = this.chartMetadata;

    const series: EChartOption.Series[] = [
      barSeries({
        name: SeriesTypes.ACCEPTED,
        data: chartData.accepted as any, // TODO(ts)
        barMinHeight: 1,
        stack: 'usage',
        legendHoverLink: false,
      }),
      barSeries({
        name: SeriesTypes.DROPPED,
        data: chartData.dropped as any, // TODO(ts)
        stack: 'usage',
        legendHoverLink: false,
      }),
      barSeries({
        name: SeriesTypes.PROJECTED,
        data: chartData.projected as any, // TODO(ts)
        barMinHeight: 1,
        stack: 'usage',
        legendHoverLink: false,
      }),
    ];

    // Additional series passed by parent component
    if (chartSeries) {
      series.concat(chartSeries as EChartOption.Series[]);
    }

    return series;
  }

  get chartLegend() {
    const {chartData} = this.chartMetadata;
    const legend = [
      {
        name: SeriesTypes.ACCEPTED,
      },
    ];

    if (chartData.dropped.length > 0) {
      legend.push({
        name: SeriesTypes.DROPPED,
      });
    }

    if (chartData.projected.length > 0) {
      legend.push({
        name: SeriesTypes.PROJECTED,
      });
    }

    return legend;
  }

  get chartTooltip() {
    const {chartTooltip} = this.props;

    if (chartTooltip) {
      return chartTooltip;
    }

    const {tooltipValueFormatter} = this.chartMetadata;

    return Tooltip({
      // Trigger to axis prevents tooltip from redrawing when hovering
      // over individual bars
      trigger: 'axis',
      valueFormatter: tooltipValueFormatter,
    });
  }

  render() {
    const {theme, title, footer} = this.props;
    const {xAxisData, yAxisMinInterval, yAxisFormatter} = this.chartMetadata;

    return (
      <Panel id="usage-chart">
        <ChartContainer>
          <HeaderTitleLegend>{title || t('Current Usage Period')}</HeaderTitleLegend>
          <BaseChart
            colors={this.chartColors}
            grid={{bottom: '3px', left: '0px', right: '10px', top: '40px'}}
            xAxis={xAxis({
              show: true,
              type: 'category',
              name: 'Date',
              boundaryGap: true,
              data: xAxisData,
              truncate: 6,
              axisTick: {
                interval: 6,
                alignWithLabel: true,
              },
              axisLabel: {
                interval: 6,
              },
              theme,
            })}
            yAxis={{
              min: 0,
              minInterval: yAxisMinInterval,
              axisLabel: {
                formatter: yAxisFormatter,
                color: theme.chartLabel,
              },
            }}
            series={this.chartSeries}
            tooltip={this.chartTooltip}
            onLegendSelectChanged={() => {}}
            legend={Legend({
              right: 10,
              top: 5,
              data: this.chartLegend,
              theme,
            })}
          />
        </ChartContainer>
        {footer}
      </Panel>
    );
  }
}

export default withTheme(UsageChart);
