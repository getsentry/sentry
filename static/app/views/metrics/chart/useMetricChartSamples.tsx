import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {XAXisOption, YAXisOption} from 'echarts/types/dist/shared';
import moment from 'moment';

import {getFormatter} from 'sentry/components/charts/components/tooltip';
import {isChartHovered} from 'sentry/components/charts/utils';
import type {Field} from 'sentry/components/metrics/metricSamplesTable';
import {t} from 'sentry/locale';
import type {EChartClickHandler, ReactEchartsRef} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import mergeRefs from 'sentry/utils/mergeRefs';
import {isCumulativeOp} from 'sentry/utils/metrics';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {
  getSummaryValueForOp,
  type MetricsSamplesResults,
} from 'sentry/utils/metrics/useMetricsSamples';
import {fitToValueRect} from 'sentry/views/metrics/chart/chartUtils';
import type {
  CombinedMetricChartProps,
  ScatterSeries,
  Series,
} from 'sentry/views/metrics/chart/types';

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

// TODO: remove this once we have a stabilized type for this
type EChartMouseEventParam = Parameters<EChartClickHandler>[0];

interface UseMetricChartSamplesOptions {
  timeseries: Series[];
  highlightedSampleId?: string;
  onSampleClick?: (sample: MetricsSamplesResults<Field>['data'][number]) => void;
  operation?: string;
  samples?: MetricsSamplesResults<Field>['data'];
  unit?: string;
}

export function useMetricChartSamples({
  timeseries,
  highlightedSampleId,
  onSampleClick,
  operation,
  samples,
  unit = '',
}: UseMetricChartSamplesOptions) {
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
        return formatMetricUsingUnit(yValue, unit);
      },
    };
  }, [operation, samplesById, unit]);

  const handleClick = useCallback<EChartClickHandler>(
    (event: EChartMouseEventParam) => {
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
