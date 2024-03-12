import type {RefObject} from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {XAXisOption, YAXisOption} from 'echarts/types/dist/shared';
import moment from 'moment';

import {getFormatter} from 'sentry/components/charts/components/tooltip';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {Field} from 'sentry/components/ddm/metricSamplesTable';
import {t} from 'sentry/locale';
import type {EChartClickHandler, ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import mergeRefs from 'sentry/utils/mergeRefs';
import {isCumulativeOp} from 'sentry/utils/metrics';
import {formatMetricsUsingUnitAndOp} from 'sentry/utils/metrics/formatters';
import type {MetricCorrelation, MetricSummary} from 'sentry/utils/metrics/types';
import {
  getSummaryValueForOp,
  type MetricsSamplesResults,
} from 'sentry/utils/metrics/useMetricsSamples';
import {fitToValueRect} from 'sentry/views/ddm/chart/chartUtils';
import type {
  CombinedMetricChartProps,
  ScatterSeries,
  Series,
} from 'sentry/views/ddm/chart/types';
import type {Sample} from 'sentry/views/ddm/widget';

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

  return {
    xMin: Math.min(...xValues),
    xMax: Math.max(...xValues),
    yMin: Math.min(0, ...yValues) / scalingFactor,
    yMax: Math.max(0, ...yValues) / scalingFactor,
  };
}

type UseChartSamplesProps = {
  timeseries: Series[];
  chartRef?: RefObject<ReactEchartsRef>;
  correlations?: MetricCorrelation[];
  highlightedSampleId?: string;
  onClick?: (sample: Sample) => void;
  onMouseOut?: (sample: Sample) => void;
  onMouseOver?: (sample: Sample) => void;
  operation?: string;
  unit?: string;
};

// TODO: remove this once we have a stabilized type for this
type ChartSample = MetricCorrelation & MetricSummary;
type EChartMouseEventParam = Parameters<EChartClickHandler>[0];

export function useMetricChartSamples({
  correlations,
  onClick,
  highlightedSampleId,
  unit = '',
  operation,
  timeseries,
}: UseChartSamplesProps) {
  const theme = useTheme();
  const chartRef = useRef<ReactEchartsRef>(null);

  const [valueRect, setValueRect] = useState(() => getValueRectFromSeries(timeseries));

  const samples: Record<string, ChartSample> = useMemo(() => {
    return (correlations ?? [])
      ?.flatMap(correlation => [
        ...correlation.metricSummaries.map(summaries => ({...summaries, ...correlation})),
      ])
      .reduce((acc, sample) => {
        acc[sample.transactionId] = sample;
        return acc;
      }, {});
  }, [correlations]);

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

  const getSample = useCallback(
    (event: EChartMouseEventParam): ChartSample | undefined => {
      return samples[event.seriesId];
    },
    [samples]
  );

  const handleClick = useCallback<EChartClickHandler>(
    (event: EChartMouseEventParam) => {
      if (!onClick) {
        return;
      }
      const sample = getSample(event);
      if (!sample) {
        return;
      }
      onClick(sample);
    },
    [getSample, onClick]
  );

  const formatterOptions = useMemo(() => {
    return {
      isGroupedByDate: true,
      limit: 1,
      showTimeInTooltip: true,
      addSecondsToTimeFormat: true,
      nameFormatter: (name: string) => {
        return t('Event %s', name.substring(0, 8));
      },
      valueFormatter: (_, label?: string) => {
        // We need to access the sample as the charts datapoints are fit to the charts viewport
        const sample = samples[label ?? ''];
        const yValue = ((sample.min ?? 0) + (sample.max ?? 0)) / 2;
        return formatMetricsUsingUnitAndOp(yValue, unit, operation);
      },
    };
  }, [operation, samples, unit]);

  const applyChartProps = useCallback(
    (baseProps: CombinedMetricChartProps): CombinedMetricChartProps => {
      let series: ScatterSeries[] = [];
      // TODO: for now we do not show samples for cumulative operations,
      // we will implement them as marklines
      if (!isCumulativeOp(operation)) {
        const newYAxisIndex = Array.isArray(baseProps.yAxes) ? baseProps.yAxes.length : 1;
        const newXAxisIndex = Array.isArray(baseProps.xAxes) ? baseProps.xAxes.length : 1;

        series = Object.values(samples).map((sample, index) => {
          const isHighlighted = highlightedSampleId === sample.transactionId;

          const xValue = moment(sample.timestamp).valueOf();
          const yValue = ((sample.min ?? 0) + (sample.max ?? 0)) / 2;

          const [xPosition, yPosition] = fitToValueRect(xValue, yValue, valueRect);

          const symbol = yPosition === yValue ? 'circle' : 'arrow';
          const symbolRotate = yPosition > yValue ? 180 : 0;

          return {
            seriesName: sample.transactionId,
            id: `${index}_${sample.spanId}`,
            operation: '',
            unit: '',
            symbolSize: isHighlighted ? 20 : 11,
            animation: false,
            symbol,
            symbolRotate,
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
            z: 10,
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

            // Hovering a single correlated sample datapoint
            if (params.seriesType === 'scatter') {
              return getFormatter(formatterOptions)(params, asyncTicket);
            }

            const baseFormatter = baseProps.tooltip?.formatter;
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
      operation,
      samples,
      theme.purple400,
      theme.white,
      valueRect,
      xAxis,
      yAxis,
    ]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => ({
      applyChartProps,
    }),
    [applyChartProps]
  );
}

interface UseMetricChartSamplesV2Options {
  timeseries: Series[];
  highlightedSampleId?: string;
  onSampleClick?: (sample: MetricsSamplesResults<Field>['data'][number]) => void;
  operation?: string;
  samples?: MetricsSamplesResults<Field>['data'];
  unit?: string;
}

export function useMetricChartSamplesV2({
  timeseries,
  highlightedSampleId,
  onSampleClick,
  operation,
  samples,
  unit = '',
}: UseMetricChartSamplesV2Options) {
  const theme = useTheme();
  const chartRef = useRef<ReactEchartsRef>(null);

  const [valueRect, setValueRect] = useState(() => getValueRectFromSeries(timeseries));

  const samplesById = useMemo(() => {
    return (samples ?? []).reduce((acc, sample) => {
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
      valueFormatter: (_, label?: string) => {
        // We need to access the sample as the charts datapoints are fit to the charts viewport
        const sample = samplesById[label ?? ''];
        const yValue = getSummaryValueForOp(sample.summary, operation);
        return formatMetricsUsingUnitAndOp(yValue, unit, operation);
      },
    };
  }, [operation, samplesById, unit]);

  const handleClick = useCallback<EChartClickHandler>(
    (event: EChartMouseEventParam) => {
      const sample = samplesById[event.seriesId];
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

      if (!isCumulativeOp(operation)) {
        series = (samples ?? []).map((sample, index) => {
          const isHighlighted = highlightedSampleId === sample.id;

          const xValue = moment(sample.timestamp).valueOf();
          const value = getSummaryValueForOp(sample.summary, operation);
          const yValue = value;

          const [xPosition, yPosition] = fitToValueRect(xValue, yValue, valueRect);

          return {
            seriesName: sample.id,
            id: `${index}_${sample.id}`,
            operation: '',
            unit: '',
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
            z: 10,
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

            // Hovering a single correlated sample datapoint
            if (params.seriesType === 'scatter') {
              return getFormatter(formatterOptions)(params, asyncTicket);
            }

            const baseFormatter = baseProps.tooltip?.formatter;
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
      operation,
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
