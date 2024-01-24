import {useCallback, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import debounce from 'lodash/debounce';
import moment from 'moment';

import {Sample} from 'sentry/views/ddm/widget';

type UseMetricSamplesProps = {
  numOfTimeseries: number;
  valueFormatter;
  chartRef?: any;
  highlightedSampleId?: string;
  onClick?: (sample: Sample) => void;
  onMouseOut?: (sample: Sample) => void;
  onMouseOver?: (sample: Sample) => void;
  sampleSeries?: any[];
};

export function getChartBounds(chartRef?: any) {
  const chartInstance = chartRef?.current?.getEchartsInstance();

  if (!chartInstance) {
    return {};
  }

  const finder = {xAxisId: 'xAxis', yAxisId: 'yAxis'};

  const topLeft = chartInstance.convertFromPixel(finder, [0, 0]);
  const bottomRight = chartInstance.convertFromPixel(finder, [
    chartInstance.getWidth(),
    chartInstance.getHeight(),
  ]);

  if (!topLeft || !bottomRight) {
    return {};
  }

  const xMin = moment(topLeft[0]).valueOf();
  const xMax = moment(bottomRight[0]).valueOf();
  const yMin = Math.max(0, bottomRight[1]);
  const yMax = topLeft[1];

  return {
    xMin,
    xMax,
    yMin,
    yMax,
  };
}

function fitToRect([x, y], {xMin, xMax, yMin, yMax}) {
  const xValue = x <= xMin ? xMin : x >= xMax ? xMax : x;

  const yValue = y <= yMin ? yMin : y >= yMax ? yMax : y;

  return [xValue, yValue];
}

export function useMetricSamples({
  sampleSeries,
  numOfTimeseries,
  onMouseOver,
  onMouseOut,
  onClick,
  highlightedSampleId,
  chartRef,
  valueFormatter,
}: UseMetricSamplesProps) {
  const theme = useTheme();

  const chartBounds = getChartBounds(chartRef);

  const xAxis = useMemo(() => {
    return {
      id: 'xAxisScatter',
      scale: true,
      show: false,
      axisLabel: {
        formatter: () => {
          return '';
        },
      },
      min: chartBounds.xMin,
      max: chartBounds.xMax,
    };
  }, [chartBounds.xMin, chartBounds.xMax]);

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
      min: chartBounds.yMin,
      max: chartBounds.yMax,
    };
  }, [chartBounds.yMin, chartBounds.yMax]);

  const getSample = useCallback(
    ({seriesIndex}) => {
      const isSpanSample = seriesIndex >= numOfTimeseries;
      const sampleSeriesIndex = seriesIndex - numOfTimeseries;
      if (isSpanSample) {
        return sampleSeries?.[sampleSeriesIndex] as Sample;
      }
      return undefined;
    },
    [sampleSeries, numOfTimeseries]
  );

  const handleMouseOver = useCallback(
    event => {
      if (!onMouseOver) {
        return;
      }
      const sample = getSample(event);
      if (!sample) {
        return;
      }
      const debouncedMouseOver = debounce(onMouseOver, 1);
      debouncedMouseOver(sample);
    },
    [getSample, onMouseOver]
  );

  const handleMouseOut = useCallback(
    event => {
      if (!onMouseOut) {
        return;
      }
      const sample = getSample(event);
      if (!sample) {
        return;
      }
      onMouseOut(sample);
      const debouncedMouseOut = debounce(onMouseOut, 1);
      debouncedMouseOut(sample);
    },
    [getSample, onMouseOut]
  );

  const handleHighlight = useCallback(
    event => {
      if (!onMouseOver || !onMouseOut || !event.batch?.[0]) {
        return;
      }

      const sample = getSample(event.batch[0]);
      if (!sample) {
        // const debouncedMouseOut = debounce(onMouseOut, 100);
        // debouncedMouseOut(sample);
        onMouseOut();
      } else {
        // const debouncedMouseOver = debounce(onMouseOver, 100);
        // debouncedMouseOver(sample);
        onMouseOver(sample);
      }
    },
    [getSample, onMouseOver, onMouseOut]
  );

  const handleClick = useCallback(
    event => {
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
    return sampleSeries
      ?.flatMap(correlation => [
        ...correlation.metricSummaries.map(summaries => ({...summaries, ...correlation})),
      ])
      .map(span => {
        const isHighlighted = highlightedSampleId === span.transactionId;

        const xValue = moment(span.timestamp).valueOf();
        const yValue = (span.min + span.max) / 2;

        const [xPosition, yPosition] = fitToRect([xValue, yValue], chartBounds);

        const symbol = yPosition === yValue ? 'circle' : 'triangle';

        return {
          seriesName: span.transactionId.slice(0, 8),
          unit: '',
          symbolSize: isHighlighted ? 20 : 10,
          animation: false,
          symbol,
          color: theme.purple400,
          // TODO: for now we just pass these ids through, but we should probably index
          // samples by an id and then just pass that reference
          transactionId: span.transactionId,
          spanId: span.spanId,
          projectId: span.projectId,
          itemStyle: {
            color: theme.purple400,
            opacity: isHighlighted ? 0.9 : 0.75,
          },
          yAxisIndex: 1,
          xAxisIndex: 1,
          xValue,
          yValue,
          data: [
            {
              name: xPosition,
              value: yPosition,
            },
          ],
          z: 10,
        };
      });
  }, [sampleSeries, highlightedSampleId, theme.purple400, chartBounds]);

  const formatters = useMemo(() => {
    return {
      isGroupedByDate: true,
      limit: 1,
      showTimeInTooltip: true,
      addSecondsToTimeFormat: true,
      valueFormatter: (value: number, label?: string) => {
        // TODO: index by some id to speed this up
        const sample = series?.find(span => span.seriesName === label);

        return valueFormatter(sample?.yValue || value);
      },
    };
  }, [series, valueFormatter]);

  return {
    handleMouseOver,
    handleMouseOut,
    handleClick,
    handleHighlight,
    series,
    xAxis,
    yAxis,
    formatters,
  };
}
