import {useMemo} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Color from 'color';
import type {
  BarSeriesOption,
  LegendComponentOption,
  SeriesOption,
  TooltipComponentOption,
} from 'echarts';

import BaseChart from 'sentry/components/charts/baseChart';
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
import {parsePeriodToHours, statsPeriodToDays} from 'sentry/utils/dates';
import {hasCustomMetrics} from 'sentry/utils/metrics/features';
import commonTheme from 'sentry/utils/theme';
import useOrganization from 'sentry/utils/useOrganization';

import {formatUsageWithUnits} from '../utils';

import {getTooltipFormatter, getXAxisDates, getXAxisLabelInterval} from './utils';

const GIGABYTE = 10 ** 9;

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
    label: DATA_CATEGORY_INFO.metrics.titleName,
    value: DATA_CATEGORY_INFO.metrics.plural,
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

const enum SeriesTypes {
  ACCEPTED = 'Accepted',
  DROPPED = 'Dropped',
  PROJECTED = 'Projected',
  RESERVED = 'Reserved',
  FILTERED = 'Filtered',
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
    dropped: [],
    projected: [],
    filtered: [],
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
  dropped: NonNullable<BarSeriesOption['data']>;
  projected: NonNullable<BarSeriesOption['data']>;
  filtered?: NonNullable<BarSeriesOption['data']>;
  onDemand?: NonNullable<BarSeriesOption['data']>;
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
  xAxisLabelInterval: number;
  xAxisTickInterval: number;
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

  const {xAxisTickInterval, xAxisLabelInterval} = getXAxisLabelInterval(
    dataPeriod,
    dataPeriod / barPeriod
  );

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

  return {
    chartLabel: label,
    chartData,
    xAxisData: xAxisDates,
    xAxisTickInterval,
    xAxisLabelInterval,
    yAxisMinInterval,
    tooltipValueFormatter: getTooltipFormatter(dataCategory),
  };
}

function chartColors(theme: Theme, dataCategory: UsageChartProps['dataCategory']) {
  const COLOR_PROJECTED = theme.chartOther;

  if (dataCategory === DATA_CATEGORY_INFO.error.plural) {
    return [COLOR_ERRORS, COLOR_FILTERED, COLOR_DROPPED, COLOR_PROJECTED];
  }

  if (dataCategory === DATA_CATEGORY_INFO.attachment.plural) {
    return [COLOR_ATTACHMENTS, COLOR_FILTERED, COLOR_DROPPED, COLOR_PROJECTED];
  }

  return [COLOR_TRANSACTIONS, COLOR_FILTERED, COLOR_DROPPED, COLOR_PROJECTED];
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
}: UsageChartProps) {
  const theme = useTheme();
  const organization = useOrganization();

  const filteredOptions = useMemo(() => {
    return categoryOptions.filter(option => {
      if (option.value !== DATA_CATEGORY_INFO.metrics.plural) {
        return true;
      }
      return (
        hasCustomMetrics(organization) && organization.features.includes('metrics-stats')
      );
    });
  }, [organization, categoryOptions]);

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
    xAxisTickInterval,
    xAxisLabelInterval,
    yAxisMinInterval,
  } = chartMetadata({
    categoryOptions: filteredOptions,
    dataCategory,
    handleDataTransformation: handleDataTransformation!,
    usageStats,
    dataTransform,
    usageDateStart,
    usageDateEnd,
    usageDateInterval,
    usageDateShowUtc,
  });

  function chartLegendData() {
    const legend: LegendComponentOption['data'] = [
      chartData.reserved && chartData.reserved.length > 0
        ? {
            name: SeriesTypes.RESERVED,
          }
        : {
            name: SeriesTypes.ACCEPTED,
          },
    ];

    if (chartData.filtered && chartData.filtered.length > 0) {
      legend.push({
        name: SeriesTypes.FILTERED,
      });
    }

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

    if (chartSeries) {
      chartSeries.forEach(chartOption => {
        legend.push({name: `${chartOption.name}`});
      });
    }

    return legend;
  }

  const colors = categoryColors?.length
    ? categoryColors
    : chartColors(theme, dataCategory);

  const series: SeriesOption[] = [
    barSeries({
      name: SeriesTypes.ACCEPTED,
      data: chartData.accepted,
      barMinHeight: 1,
      stack: 'usage',
      legendHoverLink: false,
    }),
    barSeries({
      name: SeriesTypes.FILTERED,
      data: chartData.filtered,
      barMinHeight: 1,
      stack: 'usage',
      legendHoverLink: false,
    }),
    barSeries({
      name: SeriesTypes.DROPPED,
      data: chartData.dropped,
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
      grid={{bottom: '3px', left: '3px', right: '10px', top: '40px'}}
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
      onLegendSelectChanged={() => {}}
      legend={Legend({
        right: 10,
        top: 5,
        data: chartLegendData(),
        theme,
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
