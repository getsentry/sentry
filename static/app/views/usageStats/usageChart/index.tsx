import React from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';
import {EChartOption} from 'echarts';

import BaseChart from 'app/components/charts/baseChart';
import Legend from 'app/components/charts/components/legend';
import Tooltip from 'app/components/charts/components/tooltip';
import xAxis from 'app/components/charts/components/xAxis';
import barSeries from 'app/components/charts/series/barSeries';
import {ChartContainer, HeaderTitleLegend} from 'app/components/charts/styles';
import LoadingIndicator from 'app/components/loadingIndicator';
import Panel from 'app/components/panels/panel';
import Placeholder from 'app/components/placeholder';
import ChartPalette from 'app/constants/chartPalette';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DataCategory, DataCategoryName, IntervalPeriod, SelectValue} from 'app/types';
import {parsePeriodToHours, statsPeriodToDays} from 'app/utils/dates';
import {formatAbbreviatedNumber} from 'app/utils/formatters';
import commonTheme, {Theme} from 'app/utils/theme';

import {formatUsageWithUnits, GIGABYTE} from '../utils';

import {getTooltipFormatter, getXAxisDates, getXAxisLabelInterval} from './utils';

const COLOR_ERRORS = Color(ChartPalette[4][3]).lighten(0.25).string();
const COLOR_TRANSACTIONS = Color(ChartPalette[4][2]).lighten(0.35).string();
const COLOR_ATTACHMENTS = Color(ChartPalette[4][1]).lighten(0.65).string();
const COLOR_DROPPED = commonTheme.red300;
const COLOR_PROJECTED = commonTheme.gray100;

export const CHART_OPTIONS_DATACATEGORY: SelectValue<DataCategory>[] = [
  {
    label: DataCategoryName[DataCategory.ERRORS],
    value: DataCategory.ERRORS,
    disabled: false,
  },
  {
    label: DataCategoryName[DataCategory.TRANSACTIONS],
    value: DataCategory.TRANSACTIONS,
    disabled: false,
  },
  {
    label: DataCategoryName[DataCategory.ATTACHMENTS],
    value: DataCategory.ATTACHMENTS,
    disabled: false,
  },
];

export enum ChartDataTransform {
  CUMULATIVE = 'cumulative',
  PERIODIC = 'periodic',
}

export const CHART_OPTIONS_DATA_TRANSFORM: SelectValue<ChartDataTransform>[] = [
  {
    label: t('Cumulative'),
    value: ChartDataTransform.CUMULATIVE,
    disabled: false,
  },
  {
    label: t('Periodic'),
    value: ChartDataTransform.PERIODIC,
    disabled: false,
  },
];

export enum SeriesTypes {
  ACCEPTED = 'Accepted',
  DROPPED = 'Dropped',
  PROJECTED = 'Projected',
}

type DefaultProps = {
  /**
   * Display datetime in UTC
   */
  usageDateShowUtc: boolean;

  /**
   * Intervals between the x-axis values
   */
  usageDateInterval: IntervalPeriod;

  /**
   * Modify the usageStats using the transformation method selected.
   * 1. This must be a pure function!
   * 2. If the parent component will handle the data transformation, you should
   *    replace this prop with "(s) => {return s}"
   */
  handleDataTransformation: (
    stats: ChartStats,
    transform: ChartDataTransform
  ) => ChartStats;
};

type Props = DefaultProps & {
  theme: Theme;

  isLoading?: boolean;
  isError?: boolean;
  errors?: Record<string, Error>;

  title?: React.ReactNode;
  footer?: React.ReactNode;

  dataCategory: DataCategory;
  dataTransform: ChartDataTransform;

  usageDateStart: string;
  usageDateEnd: string;

  /**
   * Usage data to draw on chart
   */
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
  static defaultProps: DefaultProps = {
    usageDateShowUtc: true,
    usageDateInterval: '1d',
    handleDataTransformation: (stats, transform) => {
      const chartData: ChartStats = {
        accepted: [],
        dropped: [],
        projected: [],
      };
      const isCumulative = transform === ChartDataTransform.CUMULATIVE;

      Object.keys(stats).forEach(k => {
        let count = 0;

        chartData[k] = stats[k].map(stat => {
          const [x, y] = stat.value;
          count = isCumulative ? count + y : y;

          return {
            ...stat,
            value: [x, count],
          };
        });
      });

      return chartData;
    },
  };

  state: State = {
    xAxisDates: [],
  };

  /**
   * UsageChart needs to generate the X-Axis dates as props.usageStats may
   * not pass the complete range of X-Axis data points
   *
   * E.g. usageStats.accepted covers day 1-15 of a month, usageStats.projected
   * either covers day 16-30 or may not be available at all.
   */
  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    const {usageDateStart, usageDateEnd, usageDateShowUtc, usageDateInterval} = nextProps;

    return {
      ...prevState,
      xAxisDates: getXAxisDates(
        usageDateStart,
        usageDateEnd,
        usageDateShowUtc,
        usageDateInterval
      ),
    };
  }

  get chartColors() {
    const {dataCategory} = this.props;

    if (dataCategory === DataCategory.ERRORS) {
      return [COLOR_ERRORS, COLOR_DROPPED, COLOR_PROJECTED];
    }

    if (dataCategory === DataCategory.ATTACHMENTS) {
      return [COLOR_ATTACHMENTS, COLOR_DROPPED, COLOR_PROJECTED];
    }

    return [COLOR_TRANSACTIONS, COLOR_DROPPED, COLOR_PROJECTED];
  }

  get chartMetadata(): {
    chartLabel: React.ReactNode;
    chartData: ChartStats;
    xAxisData: string[];
    xAxisTickInterval: number;
    xAxisLabelInterval: number;
    yAxisMinInterval: number;
    yAxisFormatter: (val: number) => string;
    tooltipValueFormatter: (val?: number) => string;
  } {
    const {usageDateStart, usageDateEnd} = this.props;
    const {
      usageDateInterval,
      usageStats,
      dataCategory,
      dataTransform,
      handleDataTransformation,
    } = this.props;
    const {xAxisDates} = this.state;

    const selectDataCategory = CHART_OPTIONS_DATACATEGORY.find(
      o => o.value === dataCategory
    );
    if (!selectDataCategory) {
      throw new Error('Selected item is not supported');
    }

    // Do not assume that handleDataTransformation is a pure function
    const chartData: ChartStats = {
      ...handleDataTransformation(usageStats, dataTransform),
    };

    Object.keys(chartData).forEach(k => {
      const isProjected = k === SeriesTypes.PROJECTED;

      // Map the array and destructure elements to avoid side-effects
      chartData[k] = chartData[k].map(stat => {
        return {
          ...stat,
          tooltip: {show: false},
          itemStyle: {opacity: isProjected ? 0.6 : 1},
        };
      });
    });

    // Use hours as common units
    const dataPeriod = statsPeriodToDays(undefined, usageDateStart, usageDateEnd) * 24;
    const barPeriod = parsePeriodToHours(usageDateInterval);
    if (dataPeriod < 0 || barPeriod < 0) {
      throw new Error('UsageChart: Unable to parse data time period');
    }

    const {xAxisTickInterval, xAxisLabelInterval} = getXAxisLabelInterval(
      dataPeriod,
      dataPeriod / barPeriod
    );

    const {label, value} = selectDataCategory;

    if (value === DataCategory.ERRORS || value === DataCategory.TRANSACTIONS) {
      return {
        chartLabel: label,
        chartData,
        xAxisData: xAxisDates,
        xAxisTickInterval,
        xAxisLabelInterval,
        yAxisMinInterval: 100,
        yAxisFormatter: formatAbbreviatedNumber,
        tooltipValueFormatter: getTooltipFormatter(dataCategory),
      };
    }

    return {
      chartLabel: label,
      chartData,
      xAxisData: xAxisDates,
      xAxisTickInterval,
      xAxisLabelInterval,
      yAxisMinInterval: 0.5 * GIGABYTE,
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

    let series: EChartOption.Series[] = [
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
      series = series.concat(chartSeries as EChartOption.Series[]);
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

  renderChart() {
    const {theme, title, isLoading, isError, errors} = this.props;
    if (isLoading) {
      return (
        <Placeholder height="200px">
          <LoadingIndicator mini />
        </Placeholder>
      );
    }

    if (isError) {
      return (
        <Placeholder height="200px">
          <IconWarning size={theme.fontSizeExtraLarge} />
          <ErrorMessages>
            {errors &&
              Object.keys(errors).map(k => <span key={k}>{errors[k]?.message}</span>)}
          </ErrorMessages>
        </Placeholder>
      );
    }

    const {
      xAxisData,
      xAxisTickInterval,
      xAxisLabelInterval,
      yAxisMinInterval,
      yAxisFormatter,
    } = this.chartMetadata;

    return (
      <React.Fragment>
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
            axisTick: {
              interval: xAxisTickInterval,
              alignWithLabel: true,
            },
            axisLabel: {
              interval: xAxisLabelInterval,
              formatter: (label: string) => label.slice(0, 6), // Limit label to 6 chars
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
      </React.Fragment>
    );
  }

  render() {
    const {footer} = this.props;

    return (
      <Panel id="usage-chart">
        <ChartContainer>{this.renderChart()}</ChartContainer>
        {footer}
      </Panel>
    );
  }
}

export default withTheme(UsageChart);

const ErrorMessages = styled('div')`
  display: flex;
  flex-direction: column;

  margin-top: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;
