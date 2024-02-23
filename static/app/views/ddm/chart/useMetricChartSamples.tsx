import type {RefObject} from 'react';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {XAXisOption} from 'echarts/types/dist/shared';
import moment from 'moment';

import {getFormatter} from 'sentry/components/charts/components/tooltip';
import {isChartHovered} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import type {EChartClickHandler, ReactEchartsRef, Series} from 'sentry/types/echarts';
import mergeRefs from 'sentry/utils/mergeRefs';
import {isCumulativeOp} from 'sentry/utils/metrics';
import {formatMetricsUsingUnitAndOp} from 'sentry/utils/metrics/formatters';
import {getMetricValueNormalizer} from 'sentry/utils/metrics/normalizeMetricValue';
import type {MetricCorrelation, MetricSummary} from 'sentry/utils/metrics/types';
import {fitToValueRect, getValueRect} from 'sentry/views/ddm/chart/chartUtils';
import type {CombinedMetricChartProps} from 'sentry/views/ddm/chart/types';
import type {Sample} from 'sentry/views/ddm/widget';

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

function getDateRange(timeseries: Series[]) {
  if (!timeseries?.length) {
    return {min: -Infinity, max: Infinity};
  }
  const min = timeseries[0].data[0].name as number;
  const max = timeseries[0].data[timeseries[0].data.length - 1].name as number;

  return {min, max};
}

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

  const [valueRect, setValueRect] = useState(getValueRect(chartRef));

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
    setValueRect(getValueRect(chartRef));
  }, [chartRef, timeseries]);

  const xAxis: XAXisOption = useMemo(() => {
    const {min, max} = getDateRange(timeseries);

    return {
      id: 'xAxisScatter',
      scale: false,
      show: false,
      axisLabel: {
        formatter: () => {
          return '';
        },
      },
      axisPointer: {
        type: 'none',
      },
      min: Math.max(valueRect.xMin, min),
      max: Math.min(valueRect.xMax, max),
    };
  }, [valueRect.xMin, valueRect.xMax, timeseries]);

  const yAxis = useMemo(() => {
    return {
      id: 'yAxisScatter',
      scale: false,
      show: false,
      axisLabel: {
        formatter: () => {
          return '';
        },
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

  const series = useMemo(() => {
    if (isCumulativeOp(operation)) {
      // TODO: for now we do not show samples for cumulative operations,
      // we will implement them as marklines
      return [];
    }

    const normalizeMetric = getMetricValueNormalizer(unit ?? '');

    return Object.values(samples).map(sample => {
      const isHighlighted = highlightedSampleId === sample.transactionId;

      const xValue = moment(sample.timestamp).valueOf();
      const yValue = normalizeMetric(((sample.min ?? 0) + (sample.max ?? 0)) / 2) ?? 0;

      const [xPosition, yPosition] = fitToValueRect(xValue, yValue, valueRect);

      const symbol = yPosition === yValue ? 'circle' : 'arrow';
      const symbolRotate = yPosition > yValue ? 180 : 0;

      return {
        seriesName: sample.transactionId,
        id: sample.transactionId,
        operation: '',
        unit: '',
        symbolSize: isHighlighted ? 20 : 10,
        animation: false,
        symbol,
        symbolRotate,
        color: theme.purple400,
        // TODO: for now we just pass these ids through, but we should probably index
        // samples by an id and then just pass that reference
        itemStyle: {
          color: theme.purple400,
          opacity: 1,
        },
        yAxisIndex: 1,
        xAxisIndex: 1,
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
  }, [operation, unit, samples, highlightedSampleId, valueRect, theme.purple400]);

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
    [formatterOptions, handleClick, series, xAxis, yAxis]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => ({
      applyChartProps,
    }),
    [applyChartProps]
  );
}

export type UseMetricSamplesResult = ReturnType<typeof useMetricChartSamples>;
