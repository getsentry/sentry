import {useMemo} from 'react';

import styled from '@emotion/styled';

import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

const NUM_Y_BUCKETS = 10;

// Color scale from design: index = intensity 0–10
const HEATMAP_COLORS = [
  'transparent', // 0: empty
  '#dedefd', // 1
  '#b6afff', // 2
  '#8060ff', // 3
  '#5936df', // 4
  '#4212b3', // 5
  '#4a17a1', // 6
  '#66128c', // 7
  '#a32087', // 8
  '#cc3092', // 9
  '#f0369a', // 10
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
  intensityGrid: number[][];
  maxVal: number;
  minVal: number;
  timestamps: number[];
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
    return {intensityGrid: [], timestamps: [], minVal: 0, maxVal: 0};
  }

  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
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

  const maxCount = Math.max(...counts.flatMap(row => row), 1);
  const intensityGrid = counts.map(row =>
    row.map(count => (count > 0 ? Math.max(1, Math.round((count / maxCount) * 10)) : 0))
  );

  return {intensityGrid, timestamps, minVal, maxVal};
}

interface MetricHeatmapProps {
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function MetricHeatmap({timeseriesResult}: MetricHeatmapProps) {
  const visualize = useMetricVisualize();
  const aggregate = visualize.yAxis;

  const {intensityGrid, timestamps, minVal, maxVal} = useMemo(
    () => buildHeatmapData(timeseriesResult.data, aggregate),
    [timeseriesResult.data, aggregate]
  );

  const range = maxVal - minVal || 1;

  const yLabels = Array.from({length: NUM_Y_BUCKETS + 1}, (_, i) => {
    const val = maxVal - (i / NUM_Y_BUCKETS) * range;
    return formatAxisValue(val);
  });

  const xLabelCount = Math.min(6, timestamps.length);
  const xLabelIndices =
    timestamps.length <= xLabelCount
      ? timestamps.map((_, i) => i)
      : Array.from({length: xLabelCount}, (_, i) =>
          Math.round((i / (xLabelCount - 1)) * (timestamps.length - 1))
        );

  if (intensityGrid.length === 0 || timestamps.length === 0) {
    return <EmptyState>No data</EmptyState>;
  }

  return (
    <HeatmapContainer>
      <YAxis>
        {yLabels.map((label, i) => (
          <YLabel key={i}>{label}</YLabel>
        ))}
      </YAxis>
      <GridAndXAxis>
        <Grid>
          {[...intensityGrid].reverse().map((row, reversedIdx) => (
            <HeatmapRow key={reversedIdx}>
              {row.map((intensity, timeIdx) => (
                <HeatmapCell key={timeIdx} intensity={intensity} />
              ))}
            </HeatmapRow>
          ))}
        </Grid>
        <XAxis>
          {xLabelIndices.map(idx => (
            <XLabel key={idx} style={{left: `${(idx / (timestamps.length - 1)) * 100}%`}}>
              <XTick />
              {formatTimestamp(timestamps[idx]!)}
            </XLabel>
          ))}
        </XAxis>
      </GridAndXAxis>
    </HeatmapContainer>
  );
}

const HeatmapContainer = styled('div')`
  display: flex;
  width: 100%;
  height: 280px;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.sm} 0;
`;

const YAxis = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-bottom: 24px;
  flex-shrink: 0;
`;

const YLabel = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  text-align: right;
  white-space: nowrap;
  line-height: 16px;
`;

const GridAndXAxis = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
`;

const Grid = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border-radius: ${p => p.theme.radius.md};
`;

const HeatmapRow = styled('div')`
  display: flex;
  flex: 1;
  min-height: 0;
`;

const HeatmapCell = styled('div')<{intensity: number}>`
  flex: 1;
  min-width: 0;
  background-color: ${p => HEATMAP_COLORS[p.intensity] ?? 'transparent'};
`;

const XAxis = styled('div')`
  position: relative;
  height: 24px;
  flex-shrink: 0;
`;

const XLabel = styled('div')`
  position: absolute;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  white-space: nowrap;
`;

const XTick = styled('div')`
  width: 1px;
  height: 4px;
  background-color: ${p => p.theme.tokens.content.secondary};
`;

const EmptyState = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 280px;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
`;
