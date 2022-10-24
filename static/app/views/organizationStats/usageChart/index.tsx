import {Component, Fragment} from 'react';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';
import type {SeriesOption, TooltipComponentOption} from 'echarts';

import BaseChart from 'sentry/components/charts/baseChart';
import Legend from 'sentry/components/charts/components/legend';
import xAxis from 'sentry/components/charts/components/xAxis';
import barSeries from 'sentry/components/charts/series/barSeries';
import {ChartContainer, HeaderTitleLegend} from 'sentry/components/charts/styles';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {DATA_CATEGORY_NAMES} from 'sentry/constants';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DataCategory, IntervalPeriod, SelectValue} from 'sentry/types';
import {parsePeriodToHours, statsPeriodToDays} from 'sentry/utils/dates';
import getDynamicText from 'sentry/utils/getDynamicText';
import commonTheme, {Theme} from 'sentry/utils/theme';

import {formatUsageWithUnits, GIGABYTE} from '../utils';

import {getTooltipFormatter, getXAxisDates, getXAxisLabelInterval} from './utils';

type ChartProps = React.ComponentProps<typeof BaseChart>;

const COLOR_ERRORS = Color(commonTheme.dataCategory.errors).lighten(0.25).string();
const COLOR_TRANSACTIONS = Color(commonTheme.dataCategory.transactions)
  .lighten(0.35)
  .string();
const COLOR_ATTACHMENTS = Color(commonTheme.dataCategory.attachments)
  .lighten(0.65)
  .string();

const COLOR_DROPPED = commonTheme.red300;
const COLOR_FILTERED = commonTheme.pink100;

export type CategoryOption = {
  /**
   * Scale of y-axis with no usage data.
   */
  yAxisMinInterval: number;
} & SelectValue<DataCategory>;

export const CHART_OPTIONS_DATACATEGORY: CategoryOption[] = [
  {
    label: DATA_CATEGORY_NAMES[DataCategory.ERRORS],
    value: DataCategory.ERRORS,
    disabled: false,
    yAxisMinInterval: 100,
  },
  {
    label: DATA_CATEGORY_NAMES[DataCategory.TRANSACTIONS],
    value: DataCategory.TRANSACTIONS,
    disabled: false,
    yAxisMinInterval: 100,
  },
  {
    label: DATA_CATEGORY_NAMES[DataCategory.ATTACHMENTS],
    value: DataCategory.ATTACHMENTS,
    disabled: false,
    yAxisMinInterval: 0.5 * GIGABYTE,
  },
  {
    label: DATA_CATEGORY_NAMES[DataCategory.PROFILES],
    value: DataCategory.PROFILES,
    disabled: false,
    yAxisMinInterval: 100,
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
  FILTERED = 'Filtered',
}

type DefaultProps = {
  /**
   * Config for category dropdown options
   */
  categoryOptions: CategoryOption[];
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

  /**
   * Intervals between the x-axis values
   */
  usageDateInterval: IntervalPeriod;

  /**
   * Display datetime in UTC
   */
  usageDateShowUtc: boolean;
};

type Props = DefaultProps & {
  dataCategory: DataCategory;

  dataTransform: ChartDataTransform;
  theme: Theme;
  usageDateEnd: string;

  usageDateStart: string;
  /**
   * Usage data to draw on chart
   */
  usageStats: ChartStats;

  /**
   * Override chart colors for each outcome
   */
  categoryColors?: string[];

  /**
   * Additional data to draw on the chart alongside usage
   */
  chartSeries?: SeriesOption[];
  /**
   * Replace default tooltip
   */
  chartTooltip?: TooltipComponentOption;

  errors?: Record<string, Error>;
  footer?: React.ReactNode;

  isError?: boolean;

  isLoading?: boolean;

  title?: React.ReactNode;
};

type State = {
  xAxisDates: string[];
};

export type ChartStats = {
  accepted: NonNullable<SeriesOption['data']>;
  dropped: NonNullable<SeriesOption['data']>;
  projected: NonNullable<SeriesOption['data']>;
  filtered?: NonNullable<SeriesOption['data']>;
};

export class UsageChart extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    categoryOptions: CHART_OPTIONS_DATACATEGORY,
    usageDateShowUtc: true,
    usageDateInterval: '1d',
    handleDataTransformation: (stats, transform) => {
      const chartData: ChartStats = {
        accepted: [],
        dropped: [],
        projected: [],
        filtered: [],
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
    const {dataCategory, theme} = this.props;
    const COLOR_PROJECTED = theme.chartOther;

    if (dataCategory === DataCategory.ERRORS) {
      return [COLOR_ERRORS, COLOR_FILTERED, COLOR_DROPPED, COLOR_PROJECTED];
    }

    if (dataCategory === DataCategory.ATTACHMENTS) {
      return [COLOR_ATTACHMENTS, COLOR_FILTERED, COLOR_DROPPED, COLOR_PROJECTED];
    }

    return [COLOR_TRANSACTIONS, COLOR_FILTERED, COLOR_DROPPED, COLOR_PROJECTED];
  }

  get chartMetadata(): {
    chartData: ChartStats;
    chartLabel: React.ReactNode;
    tooltipValueFormatter: (val?: number) => string;
    xAxisData: string[];
    xAxisLabelInterval: number;
    xAxisTickInterval: number;
    yAxisFormatter: (val: number) => string;
    yAxisMinInterval: number;
  } {
    const {categoryOptions, usageDateStart, usageDateEnd} = this.props;
    const {
      usageDateInterval,
      usageStats,
      dataCategory,
      dataTransform,
      handleDataTransformation,
    } = this.props;
    const {xAxisDates} = this.state;

    const selectDataCategory = categoryOptions.find(o => o.value === dataCategory);
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

    const {label, yAxisMinInterval} = selectDataCategory;

    return {
      chartLabel: label,
      chartData,
      xAxisData: xAxisDates,
      xAxisTickInterval,
      xAxisLabelInterval,
      yAxisMinInterval,
      yAxisFormatter: (val: number) =>
        formatUsageWithUnits(val, dataCategory, {
          isAbbreviated: true,
          useUnitScaling: true,
        }),
      tooltipValueFormatter: getTooltipFormatter(dataCategory),
    };
  }

  get chartSeries() {
    const {chartSeries} = this.props;
    const {chartData} = this.chartMetadata;

    let series: SeriesOption[] = [
      barSeries({
        name: SeriesTypes.ACCEPTED,
        data: chartData.accepted as any, // TODO(ts)
        barMinHeight: 1,
        stack: 'usage',
        legendHoverLink: false,
      }),
      barSeries({
        name: SeriesTypes.FILTERED,
        data: chartData.filtered as any, // TODO(ts)
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
      series = series.concat(chartSeries as SeriesOption[]);
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

    if (chartData.filtered && (chartData.filtered as any[]).length > 0) {
      legend.push({
        name: SeriesTypes.FILTERED,
      });
    }

    if ((chartData.dropped as any[]).length > 0) {
      legend.push({
        name: SeriesTypes.DROPPED,
      });
    }

    if ((chartData.projected as any[]).length > 0) {
      legend.push({
        name: SeriesTypes.PROJECTED,
      });
    }
    return legend;
  }

  get chartTooltip(): ChartProps['tooltip'] {
    const {chartTooltip} = this.props;

    if (chartTooltip) {
      return chartTooltip;
    }

    const {tooltipValueFormatter} = this.chartMetadata;

    return {
      // Trigger to axis prevents tooltip from redrawing when hovering
      // over individual bars
      trigger: 'axis',
      valueFormatter: tooltipValueFormatter,
    };
  }

  renderChart() {
    const {categoryColors, theme, title, isLoading, isError, errors} = this.props;
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
          <ErrorMessages data-test-id="error-messages">
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

    const colors = categoryColors?.length ? categoryColors : this.chartColors;

    return (
      <Fragment>
        <HeaderTitleLegend>{title || t('Current Usage Period')}</HeaderTitleLegend>
        {getDynamicText({
          value: (
            <BaseChart
              colors={colors}
              grid={{bottom: '3px', left: '0px', right: '10px', top: '40px'}}
              xAxis={xAxis({
                show: true,
                type: 'category',
                name: 'Date',
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
          ),
          fixed: <Placeholder height="200px" />,
        })}
      </Fragment>
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
