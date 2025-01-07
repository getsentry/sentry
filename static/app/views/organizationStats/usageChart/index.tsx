import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {
  BarSeriesOption,
  LegendComponentOption,
  SeriesOption,
  TooltipComponentOption,
} from 'echarts';

import BaseChart, {type BaseChartProps} from 'sentry/components/charts/baseChart';
import Legend from 'sentry/components/charts/components/legend';
import xAxis from 'sentry/components/charts/components/xAxis';
import barSeries from 'sentry/components/charts/series/barSeries';
import {ChartContainer, HeaderTitleLegend} from 'sentry/components/charts/styles';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategoryInfo, IntervalPeriod, SelectValue} from 'sentry/types/core';
import {Outcome} from 'sentry/types/core';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {statsPeriodToDays} from 'sentry/utils/duration/statsPeriodToDays';

import {formatUsageWithUnits} from '../utils';

import {getTooltipFormatter, getXAxisDates, getXAxisLabelVisibility} from './utils';

const GIGABYTE = 10 ** 9;

export type CategoryOption = {
  /**
   * Scale of y-axis with no usage data.
   */
  yAxisMinInterval: number;
} & SelectValue<DataCategoryInfo['plural']>;

export const CHART_OPTIONS_DATACATEGORY: CategoryOption[] = [
  {
    label: DATA_CATEGORY_INFO.error.titleName,
    value: DATA_CATEGORY_INFO.error.plural,
    disabled: false,
    yAxisMinInterval: 100,
  },
  {
    label: DATA_CATEGORY_INFO.transaction.titleName,
    value: DATA_CATEGORY_INFO.transaction.plural,
    disabled: false,
    yAxisMinInterval: 100,
  },
  {
    label: DATA_CATEGORY_INFO.replay.titleName,
    value: DATA_CATEGORY_INFO.replay.plural,
    disabled: false,
    yAxisMinInterval: 100,
  },
  {
    label: DATA_CATEGORY_INFO.attachment.titleName,
    value: DATA_CATEGORY_INFO.attachment.plural,
    disabled: false,
    yAxisMinInterval: 0.5 * GIGABYTE,
  },
  {
    label: DATA_CATEGORY_INFO.profile.titleName,
    value: DATA_CATEGORY_INFO.profile.plural,
    disabled: false,
    yAxisMinInterval: 100,
  },
  {
    label: DATA_CATEGORY_INFO.monitor.titleName,
    value: DATA_CATEGORY_INFO.monitor.plural,
    disabled: false,
    yAxisMinInterval: 100,
  },
  {
    label: DATA_CATEGORY_INFO.span.titleName,
    value: DATA_CATEGORY_INFO.span.plural,
    disabled: false,
    yAxisMinInterval: 100,
  },
  {
    label: DATA_CATEGORY_INFO.profileDuration.titleName,
    value: DATA_CATEGORY_INFO.profileDuration.plural,
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

export const enum SeriesTypes {
  ACCEPTED = 'Accepted',
  ACCEPTED_STORED = 'Accepted (stored)',
  FILTERED = 'Filtered',
  RATE_LIMITED = 'Rate Limited',
  INVALID = 'Invalid',
  CLIENT_DISCARD = 'Client Discard',
  PROJECTED = 'Projected',
}

export type UsageChartProps = {
  dataCategory: DataCategoryInfo['plural'];
  dataTransform: ChartDataTransform;
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
   * Config for category dropdown options
   */
  categoryOptions?: CategoryOption[];
  /**
   * Additional data to draw on the chart alongside usage
   */
  chartSeries?: SeriesOption[];
  /**
   * Replace default tooltip
   */
  chartTooltip?: TooltipComponentOption;
  errors?: Record<string, Error>;
  /**
   * Modify the usageStats using the transformation method selected.
   * If the parent component will handle the data transformation, you should
   *    replace this prop with "(s) => {return s}"
   */
  handleDataTransformation?: (
    stats: Readonly<ChartStats>,
    transform: Readonly<ChartDataTransform>
  ) => ChartStats;
  isError?: boolean;
  isLoading?: boolean;
  /**
   * Selected map of each legend item.
   * Default to be selected if item is not in the map
   */
  legendSelected?: Record<string, boolean>;
  onLegendSelectChanged?: BaseChartProps['onLegendSelectChanged'];
  /**
   * Intervals between the x-axis values
   */
  usageDateInterval?: IntervalPeriod;
  /**
   * Display datetime in UTC
   */
  usageDateShowUtc?: boolean;
  yAxisFormatter?: (val: number) => string;
};

/**
 * When the data transformation is set to cumulative, the chart will display
 * the total sum of the data points up to that point.
 */
const cumulativeTotalDataTransformation: UsageChartProps['handleDataTransformation'] = (
  stats,
  transform
) => {
  const chartData: ChartStats = {
    accepted: [],
    filtered: [],
    rateLimited: [],
    invalid: [],
    clientDiscard: [],
    projected: [],
    reserved: [],
    onDemand: [],
  };
  const isCumulative = transform === ChartDataTransform.CUMULATIVE;

  Object.keys(stats).forEach(k => {
    let count = 0;

    chartData[k] = stats[k].map((stat: any) => {
      const [x, y] = stat.value;
      count = isCumulative ? count + y : y;

      return {
        ...stat,
        value: [x, count],
      };
    });
  });

  return chartData;
};

const getUnitYaxisFormatter =
  (dataCategory: UsageChartProps['dataCategory']) => (val: number) =>
    formatUsageWithUnits(val, dataCategory, {
      isAbbreviated: true,
      useUnitScaling: true,
    });

export type ChartStats = {
  accepted: NonNullable<BarSeriesOption['data']>;
  projected: NonNullable<BarSeriesOption['data']>;
  accepted_stored?: NonNullable<BarSeriesOption['data']>;
  clientDiscard?: NonNullable<BarSeriesOption['data']>;
  dropped?: NonNullable<BarSeriesOption['data']>;
  filtered?: NonNullable<BarSeriesOption['data']>;
  invalid?: NonNullable<BarSeriesOption['data']>;
  onDemand?: NonNullable<BarSeriesOption['data']>;
  rateLimited?: NonNullable<BarSeriesOption['data']>;
  reserved?: NonNullable<BarSeriesOption['data']>;
};

function chartMetadata({
  categoryOptions,
  dataCategory,
  usageStats,
  dataTransform,
  usageDateStart,
  usageDateEnd,
  usageDateInterval,
  usageDateShowUtc,
  handleDataTransformation,
}: Required<
  Pick<
    UsageChartProps,
    | 'categoryOptions'
    | 'dataCategory'
    | 'handleDataTransformation'
    | 'usageStats'
    | 'dataTransform'
    | 'usageDateStart'
    | 'usageDateEnd'
    | 'usageDateInterval'
    | 'usageDateShowUtc'
  >
>): {
  chartData: ChartStats;
  chartLabel: React.ReactNode;
  tooltipValueFormatter: (val?: number) => string;
  xAxisData: string[];
  xAxisLabelVisibility: Record<number, boolean>;
  yAxisMinInterval: number;
} {
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
    chartData[k] = chartData[k]?.map((stat: any) => {
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

  const {label, yAxisMinInterval} = selectDataCategory;

  /**
   * UsageChart needs to generate the X-Axis dates as props.usageStats may
   * not pass the complete range of X-Axis data points
   *
   * E.g. usageStats.accepted covers day 1-15 of a month, usageStats.projected
   * either covers day 16-30 or may not be available at all.
   */
  const xAxisDates = getXAxisDates(
    usageDateStart,
    usageDateEnd,
    usageDateShowUtc,
    usageDateInterval
  );

  const {xAxisLabelVisibility} = getXAxisLabelVisibility(dataPeriod, xAxisDates);

  return {
    chartLabel: label,
    chartData,
    xAxisData: xAxisDates,
    xAxisLabelVisibility,
    yAxisMinInterval,
    tooltipValueFormatter: getTooltipFormatter(dataCategory),
  };
}

function UsageChartBody({
  usageDateStart,
  usageDateEnd,
  usageStats,
  dataCategory,
  dataTransform,
  chartSeries,
  chartTooltip,
  categoryColors,
  isLoading,
  isError,
  errors,
  categoryOptions = CHART_OPTIONS_DATACATEGORY,
  usageDateInterval = '1d',
  usageDateShowUtc = true,
  yAxisFormatter,
  handleDataTransformation = cumulativeTotalDataTransformation,
  legendSelected,
  onLegendSelectChanged,
}: UsageChartProps) {
  const theme = useTheme();

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
        <IconWarning size="sm" />
        <ErrorMessages data-test-id="error-messages">
          {errors &&
            Object.keys(errors).map(k => <span key={k}>{errors[k]?.message}</span>)}
        </ErrorMessages>
      </Placeholder>
    );
  }

  const yAxisLabelFormatter = yAxisFormatter ?? getUnitYaxisFormatter(dataCategory);

  const {
    chartData,
    tooltipValueFormatter,
    xAxisData,
    yAxisMinInterval,
    xAxisLabelVisibility,
  } = chartMetadata({
    categoryOptions,
    dataCategory,
    handleDataTransformation: handleDataTransformation!,
    usageStats,
    dataTransform,
    usageDateStart,
    usageDateEnd,
    usageDateInterval,
    usageDateShowUtc,
  });
  function chartLegendData(): LegendComponentOption['data'] {
    const legend: LegendComponentOption['data'] = [];

    if (!chartData.reserved || chartData.reserved.length === 0) {
      legend.push({name: SeriesTypes.ACCEPTED});
    }

    if ((chartData.filtered ?? []).length > 0) {
      legend.push({name: SeriesTypes.FILTERED});
    }

    if ((chartData.rateLimited ?? []).length > 0) {
      legend.push({name: SeriesTypes.RATE_LIMITED});
    }

    if ((chartData.invalid ?? []).length > 0) {
      legend.push({name: SeriesTypes.INVALID});
    }

    if ((chartData.clientDiscard ?? []).length > 0) {
      legend.push({name: SeriesTypes.CLIENT_DISCARD});
    }

    if (chartData.projected.length > 0) {
      legend.push({name: SeriesTypes.PROJECTED});
    }

    if (chartSeries) {
      chartSeries.forEach(chartOption => {
        if (chartOption.name) {
          legend.push({name: `${chartOption.name}`});
        }
      });
    }

    return legend;
  }

  const colors = categoryColors?.length
    ? categoryColors
    : [
        theme.outcome[Outcome.ACCEPTED]!,
        theme.outcome[Outcome.FILTERED]!,
        theme.outcome[Outcome.RATE_LIMITED]!,
        theme.outcome[Outcome.INVALID]!,
        theme.outcome[Outcome.CLIENT_DISCARD]!,
        theme.chartOther, // Projected
      ];

  const series: SeriesOption[] = [
    barSeries({
      name: SeriesTypes.ACCEPTED,
      data: chartData.accepted,
      barMinHeight: 1,
      stack: 'usage',
      legendHoverLink: false,
    }),
    ...(chartData.accepted_stored
      ? [
          barSeries({
            name: SeriesTypes.ACCEPTED,
            data: chartData.accepted_stored,
            barMinHeight: 1,
            barGap: '-100%',
            z: 3,
            silent: true,
            tooltip: {show: false},
            itemStyle: {
              decal: {
                color: 'rgba(255, 255, 255, 0.2)',
                dashArrayX: [1, 0],
                dashArrayY: [3, 5],
                rotation: -Math.PI / 4,
              },
            },
            legendHoverLink: false,
          }),
        ]
      : []),
    barSeries({
      name: SeriesTypes.FILTERED,
      data: chartData.filtered,
      barMinHeight: 1,
      stack: 'usage',
      legendHoverLink: false,
    }),
    barSeries({
      name: SeriesTypes.RATE_LIMITED,
      data: chartData.rateLimited,
      barMinHeight: 1,
      stack: 'usage',
      legendHoverLink: false,
    }),
    barSeries({
      name: SeriesTypes.INVALID,
      data: chartData.invalid,
      stack: 'usage',
      legendHoverLink: false,
    }),
    barSeries({
      name: SeriesTypes.CLIENT_DISCARD,
      data: chartData.clientDiscard,
      stack: 'usage',
      legendHoverLink: false,
    }),
    barSeries({
      name: SeriesTypes.PROJECTED,
      data: chartData.projected,
      barMinHeight: 1,
      stack: 'usage',
      legendHoverLink: false,
    }),
    // Additional series passed by parent component
    ...(chartSeries || []),
  ];

  return (
    <BaseChart
      colors={colors}
      options={{
        aria: {
          decal: {
            show: true,
          },
        },
      }}
      grid={{bottom: '3px', left: '3px', right: '10px', top: '40px'}}
      xAxis={xAxis({
        show: true,
        type: 'category',
        name: 'Date',
        data: xAxisData,
        axisTick: {
          alignWithLabel: true,
        },
        axisLabel: {
          interval: function (index: number) {
            return xAxisLabelVisibility[index]!;
          },
          formatter: (label: string) => label.slice(0, 6), // Limit label to 6 chars
        },
        theme,
      })}
      yAxis={{
        min: 0,
        minInterval: yAxisMinInterval,
        axisLabel: {
          formatter: yAxisLabelFormatter,
          color: theme.chartLabel,
        },
      }}
      series={series}
      tooltip={
        chartTooltip
          ? chartTooltip
          : {
              // Trigger to axis prevents tooltip from redrawing when hovering
              // over individual bars
              trigger: 'axis',
              valueFormatter: tooltipValueFormatter,
            }
      }
      onLegendSelectChanged={onLegendSelectChanged}
      legend={Legend({
        right: 10,
        top: 5,
        data: chartLegendData(),
        theme,
        selected: legendSelected,
      })}
    />
  );
}

interface UsageChartPanelProps extends UsageChartProps {
  footer?: React.ReactNode;
  title?: React.ReactNode;
}

function UsageChart({title, footer, ...props}: UsageChartPanelProps) {
  return (
    <Panel id="usage-chart" data-test-id="usage-chart">
      <ChartContainer>
        <HeaderTitleLegend>{title || t('Current Usage Period')}</HeaderTitleLegend>
        <UsageChartBody {...props} />
      </ChartContainer>
      {footer}
    </Panel>
  );
}

export default UsageChart;

const ErrorMessages = styled('div')`
  display: flex;
  flex-direction: column;

  margin-top: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;
