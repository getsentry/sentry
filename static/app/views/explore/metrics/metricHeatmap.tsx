import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {VisualMap} from 'sentry/components/charts/components/visualMap';
import {HeatMapChart} from 'sentry/components/charts/heatMapChart';
import {useMockHeatmapData} from 'sentry/views/explore/metrics/hooks/useMockHeatmapData';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

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

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}:${minutes} ${period}`;
}

interface MetricHeatmapProps {
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function MetricHeatmap({timeseriesResult}: MetricHeatmapProps) {
  const theme = useTheme();
  const visualize = useMetricVisualize();
  const aggregate = visualize.yAxis;

  // TODO(experiment): replace with real multi-dim data once the endpoint supports it
  const {data, timestamps, yLabels} = useMockHeatmapData(timeseriesResult);

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
