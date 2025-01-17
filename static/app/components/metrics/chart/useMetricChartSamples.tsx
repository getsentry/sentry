import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {XAXisOption, YAXisOption} from 'echarts/types/dist/shared';
import moment from 'moment-timezone';

import {getFormatter} from 'sentry/components/charts/components/tooltip';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {
  CombinedMetricChartProps,
  ScatterSeries,
  Series,
} from 'sentry/components/metrics/chart/types';
import {fitToValueRect} from 'sentry/components/metrics/chart/utils';
import type {Field} from 'sentry/components/metrics/metricSamplesTable';
import {t} from 'sentry/locale';
import type {EChartClickHandler, ReactEchartsRef} from 'sentry/types/echarts';
import type {MetricAggregation} from 'sentry/types/metrics';
import {defined} from 'sentry/utils';
import mergeRefs from 'sentry/utils/mergeRefs';
import {isCumulativeAggregation} from 'sentry/utils/metrics';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {
  getSummaryValueForAggregation,
  type MetricsSamplesResults,
} from 'sentry/utils/metrics/useMetricsSamples';

export const SAMPLES_X_AXIS_ID = 'xAxisSamples';
export const SAMPLES_Y_AXIS_ID = 'yAxisSamples';

function getValueRectFromSeries(series: Series[]) {
  const referenceSeries = series[0];
  if (!referenceSeries) {
    return {xMin: -Infinity, xMax: Infinity, yMin: -Infinity, yMax: Infinity};
  }
  const seriesWithSameUnit = series.filter(
    s => s.unit === referenceSeries.unit && !s.hidden
  );
  const scalingFactor = referenceSeries.scalingFactor ?? 1;
  const xValues = referenceSeries.data.map(entry => entry.name);
  const yValues = [referenceSeries, ...seriesWithSameUnit].flatMap(s =>
    s.data.map(entry => entry.value)
  );

  const rect = {
    xMin: Math.min(...xValues),
    xMax: Math.max(...xValues),
    yMin: Math.min(0, ...yValues) / scalingFactor,
    yMax: Math.max(0, ...yValues) / scalingFactor,
  };

  // happens when refenceSeries has all 0 values, commonly seen when using min() aggregation
  if (rect.yMin === rect.yMax) {
    return {xMin: rect.xMin, xMax: rect.xMax, yMin: -Infinity, yMax: Infinity};
  }

  return rect;
}

// TODO: remove this once we have a stabilized type for this
type EChartMouseEventParam = Parameters<EChartClickHandler>[0];

interface UseMetricChartSamplesOptions {
  timeseries: Series[];
  aggregation?: MetricAggregation;
  highlightedSampleId?: string;
  onSampleClick?: (sample: MetricsSamplesResults<Field>['data'][number]) => void;
  samples?: MetricsSamplesResults<Field>['data'];
  unit?: string;
}

export function useMetricChartSamples({
  timeseries,
  highlightedSampleId,
  onSampleClick,
  aggregation,
  samples,
  unit = '',
}: UseMetricChartSamplesOptions) {
  const theme = useTheme();
  const chartRef = useRef<ReactEchartsRef>(null);

  const [valueRect, setValueRect] = useState(() => getValueRectFromSeries(timeseries));

  const samplesById = useMemo(() => {
    return (samples ?? []).reduce((acc, sample) => {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      acc[sample.id] = sample;
      return acc;
    }, {});
  }, [samples]);

  useEffect(() => {
    // Changes in timeseries change the valueRect since the timeseries yAxis auto scales
    // and scatter yAxis needs to match the scale
    setValueRect(getValueRectFromSeries(timeseries));
  }, [timeseries]);

  const xAxis: XAXisOption = useMemo(() => {
    return {
      id: SAMPLES_X_AXIS_ID,
      show: false,
      axisLabel: {
        show: false,
      },
      axisPointer: {
        type: 'none',
      },
      min: valueRect.xMin,
      max: valueRect.xMax,
    };
  }, [valueRect.xMin, valueRect.xMax]);

  const yAxis: YAXisOption = useMemo(() => {
    return {
      id: SAMPLES_Y_AXIS_ID,
      show: false,
      axisLabel: {
        show: false,
      },
      min: valueRect.yMin,
      max: valueRect.yMax,
    };
  }, [valueRect.yMin, valueRect.yMax]);

  const formatterOptions = useMemo(() => {
    return {
      isGroupedByDate: true,
      limit: 1,
      showTimeInTooltip: true,
      addSecondsToTimeFormat: true,
      nameFormatter: (name: string) => {
        return t('Span %s', name.substring(0, 8));
      },
      valueFormatter: (_: any, label?: string) => {
        // We need to access the sample as the charts datapoints are fit to the charts viewport
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const sample = samplesById[label ?? ''];
        const yValue = getSummaryValueForAggregation(sample.summary, aggregation);
        return formatMetricUsingUnit(yValue, unit);
      },
    };
  }, [aggregation, samplesById, unit]);

  const handleClick = useCallback<EChartClickHandler>(
    (event: EChartMouseEventParam) => {
      // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      const sample = samplesById[event.seriesName];
      if (defined(onSampleClick) && defined(sample)) {
        onSampleClick(sample);
      }
    },
    [onSampleClick, samplesById]
  );

  const applyChartProps = useCallback(
    (baseProps: CombinedMetricChartProps): CombinedMetricChartProps => {
      let series: ScatterSeries[] = [];

      const newYAxisIndex = Array.isArray(baseProps.yAxes) ? baseProps.yAxes.length : 1;
      const newXAxisIndex = Array.isArray(baseProps.xAxes) ? baseProps.xAxes.length : 1;

      if (aggregation && !isCumulativeAggregation(aggregation)) {
        series = (samples ?? []).map((sample, index) => {
          const isHighlighted = highlightedSampleId === sample.id;

          const xValue = moment(sample.timestamp).valueOf();
          const value = getSummaryValueForAggregation(sample.summary, aggregation);
          const yValue = value;

          const [xPosition, yPosition] = fitToValueRect(xValue, yValue, valueRect) as [
            number,
            number,
          ];

          return {
            seriesName: sample.id,
            id: `${index}_${sample.id}`,
            // TODO: fix type so we do not need to pass all these props
            operation: '',
            unit: '',
            aggregate: 'count',
            symbolSize: isHighlighted ? 20 : 11,
            animation: false,
            symbol: yPosition === yValue ? 'circle' : 'arrow',
            symbolRotate: yPosition > yValue ? 180 : 0,
            color: theme.purple400,
            itemStyle: {
              color: theme.purple400,
              opacity: 0.95,
              borderColor: theme.white,
              borderWidth: 1,
            },
            yAxisIndex: newYAxisIndex,
            xAxisIndex: newXAxisIndex,
            xValue,
            yValue,
            total: yValue,
            tooltip: {
              axisPointer: {
                type: 'none',
              },
            },
            data: [
              {
                name: xPosition,
                value: yPosition,
              },
            ],
            z: baseProps.series.length + 1,
          };
        });
      }

      return {
        ...baseProps,
        forwardedRef: mergeRefs([baseProps.forwardedRef, chartRef]),
        scatterSeries: series,
        xAxes: [...(Array.isArray(baseProps.xAxes) ? baseProps.xAxes : []), xAxis],
        yAxes: [...(Array.isArray(baseProps.yAxes) ? baseProps.yAxes : []), yAxis],
        onClick: (...args) => {
          handleClick(...args);
          baseProps.onClick?.(...args);
        },
        tooltip: {
          formatter: (params: any, asyncTicket) => {
            // Only show the tooltip if the current chart is hovered
            // as chart groups trigger the tooltip for all charts in the group when one is hoverered
            if (!isChartHovered(chartRef?.current)) {
              return '';
            }
            const baseFormatter = baseProps.tooltip?.formatter;

            // Hovering a single correlated sample datapoint
            if (params.seriesType === 'scatter') {
              return getFormatter({...formatterOptions, utc: !!baseProps.utc})(
                params,
                asyncTicket
              );
            }

            if (typeof baseFormatter === 'string') {
              return baseFormatter;
            }

            if (!baseFormatter) {
              throw new Error(
                'You need to define a tooltip formatter for the chart when using metric samples'
              );
            }

            return baseFormatter(params, asyncTicket);
          },
        },
      };
    },
    [
      formatterOptions,
      handleClick,
      highlightedSampleId,
      aggregation,
      samples,
      theme.purple400,
      theme.white,
      valueRect,
      xAxis,
      yAxis,
    ]
  );

  return useMemo(() => {
    if (!defined(samples)) {
      return undefined;
    }
    return {applyChartProps};
  }, [applyChartProps, samples]);
}

export type UseMetricSamplesResult = ReturnType<typeof useMetricChartSamples>;
