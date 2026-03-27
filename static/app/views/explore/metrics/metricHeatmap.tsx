import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {VisualMap} from 'sentry/components/charts/components/visualMap';
import {HeatMapChart} from 'sentry/components/charts/heatMapChart';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

const NUM_Y_BUCKETS = 10;

// Color scale interpolated across three design stops:
// #eeefff (low) → #7553ff (mid) → #990056 (high)
// Steps 1–5: segment 1, steps 6–10: segment 2
const HEATMAP_COLORS = [
  '#eeefff', // 1  — #eeefff
  '#d0c8ff', // 2
  '#b2a1ff', // 3
  '#937aff', // 4
  '#7553ff', // 5  — #7553ff
  '#7c42dd', // 6
  '#8332bb', // 7
  '#8b219a', // 8
  '#921178', // 9
  '#990056', // 10 — #990056
] as const;

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

interface HeatmapData {
  // ECharts heatmap data: [xIndex, yIndex, intensity]
  data: Array<[number, number, number]>;
  maxVal: number;
  minVal: number;
  timestamps: number[];
  yLabels: string[];
}

function buildHeatmapData(
  seriesData: Record<string, TimeSeries[]>,
  aggregate: string
): HeatmapData {
  const allSeries = seriesData[aggregate] ?? [];

  const allValues: number[] = [];
  for (const s of allSeries) {
    for (const item of s.values) {
      if (item.value !== null && !isNaN(item.value)) {
        allValues.push(item.value);
      }
    }
  }

  if (allValues.length === 0) {
    return {data: [], timestamps: [], yLabels: [], minVal: 0, maxVal: 0};
  }

  let minVal = allValues[0]!;
  let maxVal = allValues[0]!;
  for (let i = 1; i < allValues.length; i++) {
    const value = allValues[i]!;
    if (value < minVal) {
      minVal = value;
    }
    if (value > maxVal) {
      maxVal = value;
    }
  }
  const range = maxVal - minVal || 1;

  const timestampSet = new Set<number>();
  for (const s of allSeries) {
    for (const item of s.values) {
      timestampSet.add(item.timestamp);
    }
  }
  const timestamps = Array.from(timestampSet).sort((a, b) => a - b);
  const timeIndexMap = new Map(timestamps.map((t, i) => [t, i]));

  const counts: number[][] = Array.from({length: NUM_Y_BUCKETS}, () =>
    new Array(timestamps.length).fill(0)
  );

  for (const s of allSeries) {
    for (const item of s.values) {
      if (item.value === null || isNaN(item.value)) {
        continue;
      }
      const timeIdx = timeIndexMap.get(item.timestamp);
      if (timeIdx === undefined) {
        continue;
      }
      const normalized = (item.value - minVal) / range;
      const yBucket = Math.min(Math.floor(normalized * NUM_Y_BUCKETS), NUM_Y_BUCKETS - 1);
      counts[yBucket]![timeIdx]!++;
    }
  }

  let maxCount = 1;
  for (const row of counts) {
    for (const count of row) {
      if (count > maxCount) {
        maxCount = count;
      }
    }
  }

  // Build flat [xIndex, yIndex, intensity] array for ECharts.
  // Always emit every cell (including empty ones at intensity 0) so the tooltip
  // target exists across the full grid — empty cells are mapped to transparent
  // in the visualMap so they're invisible but still hoverable.
  const data: Array<[number, number, number]> = [];
  for (let yBucket = 0; yBucket < NUM_Y_BUCKETS; yBucket++) {
    for (let timeIdx = 0; timeIdx < timestamps.length; timeIdx++) {
      const count = counts[yBucket]![timeIdx]!;
      const intensity = count > 0 ? Math.max(1, Math.round((count / maxCount) * 10)) : 0;
      data.push([timeIdx, yBucket, intensity]);
    }
  }

  // Y-axis labels: bucket boundaries from high to low
  const yLabels = Array.from({length: NUM_Y_BUCKETS}, (_, i) => {
    const val = minVal + ((i + 0.5) / NUM_Y_BUCKETS) * range;
    return formatAxisValue(val);
  });

  return {data, timestamps, yLabels, minVal, maxVal};
}

interface MetricHeatmapProps {
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function MetricHeatmap({timeseriesResult}: MetricHeatmapProps) {
  const theme = useTheme();
  const visualize = useMetricVisualize();
  const aggregate = visualize.yAxis;

  const {data, timestamps, yLabels} = useMemo(
    () => buildHeatmapData(timeseriesResult.data, aggregate),
    [timeseriesResult.data, aggregate]
  );

  const xAxisLabels = useMemo(
    () => timestamps.map(ts => formatTimestamp(ts)),
    [timestamps]
  );

  if (data.length === 0 || timestamps.length === 0) {
    return null;
  }

  // HeatMapChart expects { seriesName, data, dataArray, ...HeatmapSeriesOption }
  // Pass the flat [xIdx, yIdx, intensity] triples via dataArray to skip the
  // default [name, value] mapping that HeatMapChart does on `data`.
  const series = [
    {
      seriesName: aggregate,
      data: [] as Array<{name: string; value: number}>,
      dataArray: data,
      // ECharts 5: rounded cells
      itemStyle: {
        borderRadius: 0,
        borderWidth: 1,
        borderColor: theme.background,
      },
      // ECharts 5: blur non-hovered cells on hover
      emphasis: {
        focus: 'self' as const,
        itemStyle: {
          borderRadius: 0,
          borderWidth: 2,
          borderColor: theme.tokens.border.focused,
        },
      },
      // ECharts 5: smooth transition when data updates
      universalTransition: {
        enabled: true,
      },
    },
  ];

  const visualMaps = [
    VisualMap({
      type: 'piecewise',
      show: false,
      pieces: [
        {gte: 0, lte: 0, color: 'rgba(0,0,0,0)'},
        ...HEATMAP_COLORS.map((color, i) => ({gte: i + 1, lte: i + 1, color})),
      ],
      seriesIndex: 0,
      dimension: 2,
    }),
  ];

  return (
    <HeatMapChart
      height={280}
      series={series}
      visualMaps={visualMaps}
      xAxis={{
        type: 'category',
        data: xAxisLabels,
        axisLine: {show: false},
        axisTick: {show: false},
        axisLabel: {
          color: theme.tokens.content.secondary,
          fontSize: 11,
          interval: Math.max(0, Math.floor(xAxisLabels.length / 6) - 1),
        },
        splitLine: {show: false},
      }}
      yAxis={{
        type: 'category',
        data: yLabels,
        axisLine: {show: false},
        axisTick: {show: false},
        axisLabel: {
          color: theme.tokens.content.secondary,
          fontSize: 11,
        },
        splitLine: {show: false},
      }}
      tooltip={{
        formatter: (params: any) => {
          const [timeIdx, yBucket, intensity] = params.data as [number, number, number];
          const time = xAxisLabels[timeIdx] ?? '';
          const bucket = yLabels[yBucket] ?? '';
          const body =
            intensity === 0
              ? `<div><span class="tooltip-label"><strong>${aggregate}</strong></span> No data</div>`
              : `<div><span class="tooltip-label">${params.marker} <strong>${aggregate}</strong></span> ~${bucket}</div>`;
          return [
            `<div class="tooltip-series">${body}</div>`,
            `<div class="tooltip-footer tooltip-footer-centered">${time}</div>`,
            '<div class="tooltip-arrow"></div>',
          ].join('');
        },
      }}
      grid={{top: 20, bottom: 20, left: 4, right: 0, containLabel: true}}
    />
  );
}
