import {useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import type {XAXisOption} from 'echarts/types/dist/shared';
import moment from 'moment';

import type {Series} from 'sentry/types/echarts';
import {getDuration} from 'sentry/utils/formatters';
import {isCumulativeOp} from 'sentry/utils/metrics';
import type {MetricCorrelation} from 'sentry/utils/metrics/types';
import {fitToValueRect, getValueRect} from 'sentry/views/ddm/chartUtils';
import type {Sample} from 'sentry/views/ddm/widget';

type UseMetricSamplesProps = {
  timeseries: Series[];
  chartRef?: any;
  correlations?: MetricCorrelation[];
  highlightedSampleId?: string;
  onClick?: (sample: Sample) => void;
  onMouseOut?: (sample: Sample) => void;
  onMouseOver?: (sample: Sample) => void;
  operation?: string;
};

function getDateRange(timeseries: Series[]) {
  if (!timeseries?.length) {
    return {min: -Infinity, max: Infinity};
  }
  const min = timeseries[0].data[0].name as number;
  const max = timeseries[0].data[timeseries[0].data.length - 1].name as number;

  return {min, max};
}

export function useMetricSamples({
  correlations,
  onClick,
  highlightedSampleId,
  chartRef,
  operation,
  timeseries,
}: UseMetricSamplesProps) {
  const theme = useTheme();

  const [valueRect, setValueRect] = useState(getValueRect(chartRef));

  const samples: Record<string, any> = useMemo(() => {
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
    event => {
      return samples?.[event.seriesName] as Sample;
    },
    [samples]
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
    if (isCumulativeOp(operation)) {
      // TODO: for now we do not show samples for cumulative operations,
      // we will implement them as marklines
      return [];
    }

    return Object.values(samples).map(sample => {
      const isHighlighted = highlightedSampleId === sample.transactionId;

      const xValue = moment(sample.timestamp).valueOf();
      const yValue = (sample.min + sample.max) / 2;

      const [xPosition, yPosition] = fitToValueRect(xValue, yValue, valueRect);

      const symbol = yPosition === yValue ? 'circle' : 'arrow';
      const symbolRotate = yPosition > yValue ? 180 : 0;

      return {
        seriesName: sample.transactionId,
        unit: '',
        symbolSize: isHighlighted ? 20 : 10,
        animation: false,
        symbol,
        symbolRotate,
        color: theme.purple400,
        // TODO: for now we just pass these ids through, but we should probably index
        // samples by an id and then just pass that reference
        transactionId: sample.transactionId,
        transactionSpanId: sample.transactionSpanId,
        spanId: sample.spanId,
        projectId: sample.projectId,
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
  }, [samples, highlightedSampleId, theme.purple400, valueRect, operation]);

  const formatters = useMemo(() => {
    return {
      isGroupedByDate: true,
      limit: 1,
      showTimeInTooltip: true,
      addSecondsToTimeFormat: true,
      nameFormatter: (name: string) => {
        return name.substring(0, 8);
      },
      valueFormatter: (_, label?: string) => {
        const sample = samples[label ?? ''];
        return getDuration(sample.duration / 1000, 2, true);
      },
    };
  }, [samples]);

  return {
    handleClick,
    series,
    xAxis,
    yAxis,
    formatters,
  };
}
