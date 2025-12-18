import {PureComponent} from 'react';
import type {Theme} from '@emotion/react';
import color from 'color';
import type {LineSeriesOption, TooltipComponentFormatterCallbackParams} from 'echarts';

import {extrapolatedAreaStyle} from 'sentry/components/alerts/onDemandMetricAlert';
import {AreaChart} from 'sentry/components/charts/areaChart';
import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import {defaultFormatAxisLabel} from 'sentry/components/charts/components/tooltip';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import LineSeries from 'sentry/components/charts/series/lineSeries';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {MetricRule, Trigger} from 'sentry/views/alerts/rules/metric/types';
import {
  AlertRuleThresholdType,
  AlertRuleTriggerType,
} from 'sentry/views/alerts/rules/metric/types';
import {getAnomalyMarkerSeries} from 'sentry/views/alerts/rules/metric/utils/anomalyChart';
import type {Anomaly} from 'sentry/views/alerts/types';
import {alertAxisFormatter, alertTooltipValueFormatter} from 'sentry/views/alerts/utils';
import {getChangeStatus} from 'sentry/views/alerts/utils/getChangeStatus';

type DefaultProps = {
  comparisonData: Series[];
  comparisonMarkLines: LineChartSeries[];
  data: Series[];
};

type Props = DefaultProps & {
  aggregate: string;
  hideThresholdLines: boolean;
  resolveThreshold: MetricRule['resolveThreshold'];
  theme: Theme;
  thresholdType: MetricRule['thresholdType'];
  triggers: Trigger[];
  anomalies?: Anomaly[];
  comparisonSeriesName?: string;
  includePrevious?: boolean;
  isExtrapolatedData?: boolean;
  maxValue?: number;
  minValue?: number;
  minutesThresholdToDisplaySeconds?: number;
} & Partial<PageFilters['datetime']>;

const CHART_GRID = {
  left: space(2),
  right: space(2),
  top: space(4),
  bottom: space(2),
};

// Colors to use for trigger thresholds
const makeTriggerThresholdColors = (theme: Theme) => ({
  RESOLUTION_FILL: color(theme.colors.green200).alpha(0.1).rgb().string(),
  CRITICAL_FILL: color(theme.colors.red400).alpha(0.25).rgb().string(),
  WARNING_FILL: color(theme.colors.yellow200).alpha(0.1).rgb().string(),
});

/**
 * Because the threshold can be larger than the series data, we need to
 * calculate the bounds of the chart to ensure the thresholds are visible.
 */
function getYAxisBounds(
  series: Series[],
  triggers: Trigger[],
  resolveThreshold: number | null
): {max: number | undefined; min: number | undefined} {
  // Get all threshold values
  const thresholdValues = [
    resolveThreshold || null,
    ...triggers.map(t => t.alertThreshold || null),
  ].filter((threshold): threshold is number => threshold !== null);

  if (thresholdValues.length === 0) {
    return {min: undefined, max: undefined};
  }

  // Get series data bounds
  const seriesData = series[0]?.data || [];
  const seriesValues = seriesData.map(point => point.value).filter(val => !isNaN(val));

  // Calculate bounds including thresholds
  const allValues = [...seriesValues, ...thresholdValues];
  const min = allValues.length > 0 ? Math.min(...allValues) : 0;
  const max = allValues.length > 0 ? Math.max(...allValues) : 0;

  // Add some padding to the bounds
  const padding = (max - min) * 0.1;
  const paddedMin = Math.max(0, min - padding);
  const paddedMax = max + padding;

  return {
    min: Math.round(paddedMin),
    max: Math.round(paddedMax),
  };
}

/**
 * This chart displays shaded regions that represent different Trigger thresholds in a
 * Metric Alert rule.
 */
export default class ThresholdsChart extends PureComponent<Props> {
  static defaultProps: DefaultProps = {
    data: [],
    comparisonData: [],
    comparisonMarkLines: [],
  };

  /**
   * Creates threshold line and area series
   *
   * May need to refactor so that they are aware of other trigger thresholds.
   *
   * e.g. draw warning from threshold -> critical threshold instead of the entire height of chart
   */
  getThresholdSeries = (
    trigger: Trigger,
    type: 'alertThreshold' | 'resolveThreshold',
    isResolution: boolean
  ): LineSeriesOption[] => {
    const {thresholdType, resolveThreshold, hideThresholdLines} = this.props;
    const thresholdValue = type === 'alertThreshold' ? trigger[type] : resolveThreshold;

    if (
      typeof thresholdValue !== 'number' ||
      isNaN(thresholdValue) ||
      hideThresholdLines
    ) {
      return [];
    }

    const isCritical = trigger.label === AlertRuleTriggerType.CRITICAL;
    const lineColor = isResolution
      ? this.props.theme.colors.green400
      : isCritical
        ? this.props.theme.colors.red400
        : this.props.theme.colors.yellow400;

    const COLOR = makeTriggerThresholdColors(this.props.theme);
    const areaColor = isResolution
      ? COLOR.RESOLUTION_FILL
      : isCritical
        ? COLOR.CRITICAL_FILL
        : COLOR.WARNING_FILL;

    // Create the threshold area logic
    // For "above" threshold type: area goes from threshold to top
    // For "below" threshold type: area goes from bottom to threshold
    // For resolution, the logic is inverted
    const isInverted = thresholdType === AlertRuleThresholdType.BELOW;
    const shouldAreaGoUp = isResolution !== isInverted;

    // Create a single series with both markLine and markArea
    return [
      {
        // Name isn't shown but it might be useful for debugging
        name: `${isResolution ? 'Resolution' : 'Alert'} Threshold`,
        type: 'line',
        markLine: MarkLine({
          silent: true,
          lineStyle: {
            color: lineColor,
            type: 'dashed',
            width: 1,
          },
          animation: false,
          data: [{yAxis: thresholdValue}],
          label: {
            show: false,
          },
        }),
        markArea: MarkArea({
          silent: true,
          itemStyle: {
            color: areaColor,
          },
          animation: false,
          data: [
            [
              {yAxis: shouldAreaGoUp ? thresholdValue : 'min'},
              {yAxis: shouldAreaGoUp ? 'max' : thresholdValue},
            ],
          ],
        }),
        data: [],
      },
    ];
  };

  render() {
    const {
      data,
      triggers,
      period,
      aggregate,
      comparisonData,
      comparisonSeriesName,
      comparisonMarkLines,
      minutesThresholdToDisplaySeconds,
      thresholdType,
      resolveThreshold,
      anomalies = [],
      theme,
    } = this.props;

    const dataWithoutRecentBucket = data?.map(({data: eventData, ...restOfData}) => {
      if (this.props.isExtrapolatedData) {
        return {
          ...restOfData,
          data: eventData.slice(0, -1),
          areaStyle: extrapolatedAreaStyle,
        };
      }

      return {
        ...restOfData,
        data: eventData.slice(0, -1),
      };
    });

    const comparisonDataWithoutRecentBucket = comparisonData?.map(
      ({data: eventData, ...restOfData}) => ({
        ...restOfData,
        data: eventData.slice(0, -1),
      })
    );

    const chartOptions = {
      tooltip: {
        // use the main aggregate for all series (main, min, max, avg, comparison)
        // to format all values similarly
        valueFormatter: (value: number) =>
          alertTooltipValueFormatter(value, aggregate, aggregate),

        formatAxisLabel: (
          value: number,
          isTimestamp: boolean,
          utc: boolean,
          showTimeInTooltip: boolean,
          addSecondsToTimeFormat: boolean,
          bucketSize: number | undefined,
          seriesParamsOrParam: TooltipComponentFormatterCallbackParams
        ) => {
          const date = defaultFormatAxisLabel(
            value,
            isTimestamp,
            utc,
            showTimeInTooltip,
            addSecondsToTimeFormat,
            bucketSize
          );

          const seriesParams = Array.isArray(seriesParamsOrParam)
            ? seriesParamsOrParam
            : [seriesParamsOrParam];

          const pointY =
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            (seriesParams.length > 1 ? seriesParams[0]!.data[1] : undefined) as
              | number
              | undefined;

          const comparisonSeries =
            seriesParams.length > 1
              ? seriesParams.find(({seriesName: _sn}) => _sn === comparisonSeriesName)
              : undefined;

          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          const comparisonPointY = comparisonSeries?.data[1] as number | undefined;

          if (
            comparisonPointY === undefined ||
            pointY === undefined ||
            comparisonPointY === 0
          ) {
            return `<span>${date}</span>`;
          }

          const changePercentage = ((pointY - comparisonPointY) * 100) / comparisonPointY;

          const changeStatus = getChangeStatus(changePercentage, thresholdType, triggers);

          const changeStatusColor =
            changeStatus === AlertRuleTriggerType.CRITICAL
              ? this.props.theme.colors.red400
              : changeStatus === AlertRuleTriggerType.WARNING
                ? this.props.theme.colors.yellow400
                : this.props.theme.colors.green400;

          return `<span>${date}<span style="color:${changeStatusColor};margin-left:10px;">
            ${Math.sign(changePercentage) === 1 ? '+' : '-'}${Math.abs(
              changePercentage
            ).toFixed(2)}%</span></span>`;
        },
      },
      yAxis: {
        ...getYAxisBounds(
          dataWithoutRecentBucket,
          triggers,
          resolveThreshold === '' ? null : resolveThreshold
        ),
        axisLabel: {
          formatter: (value: number) =>
            alertAxisFormatter(value, data[0]!.seriesName, aggregate),
        },
        splitLine: {
          show: false,
        },
      },
    };

    // Get threshold series for all triggers
    const thresholdSeries = triggers.flatMap((trigger: Trigger) => [
      ...this.getThresholdSeries(trigger, 'alertThreshold', false),
      ...this.getThresholdSeries(trigger, 'resolveThreshold', true),
    ]);

    return (
      <AreaChart
        isGroupedByDate
        showTimeInTooltip
        minutesThresholdToDisplaySeconds={minutesThresholdToDisplaySeconds}
        period={DEFAULT_STATS_PERIOD || period}
        grid={CHART_GRID}
        {...chartOptions}
        colors={this.props.theme.chart.getColorPalette(0)}
        series={[
          ...dataWithoutRecentBucket,
          ...comparisonMarkLines,
          ...getAnomalyMarkerSeries(anomalies, {theme}),
        ]}
        additionalSeries={[
          ...comparisonDataWithoutRecentBucket.map(({data: _data, ...otherSeriesProps}) =>
            LineSeries({
              name: comparisonSeriesName,
              data: _data.map(({name, value}) => [name, value]),
              lineStyle: {
                color: this.props.theme.colors.gray200,
                type: 'dashed',
                width: 1,
              },
              itemStyle: {color: this.props.theme.colors.gray200},
              animation: false,
              animationThreshold: 1,
              animationDuration: 0,
              ...otherSeriesProps,
            })
          ),
          ...thresholdSeries,
        ]}
      />
    );
  }
}
