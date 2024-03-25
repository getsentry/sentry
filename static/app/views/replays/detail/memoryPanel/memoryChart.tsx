import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import type {AreaChartProps} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';
import Grid from 'sentry/components/charts/components/grid';
import {ChartTooltip} from 'sentry/components/charts/components/tooltip';
import XAxis from 'sentry/components/charts/components/xAxis';
import YAxis from 'sentry/components/charts/components/yAxis';
import type {useReplayContext} from 'sentry/components/replays/replayContext';
import {formatTime} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import {formatBytesBase2} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import type {MemoryFrame} from 'sentry/utils/replays/types';
import toArray from 'sentry/utils/toArray';

interface Props
  extends Pick<
    ReturnType<typeof useReplayContext>,
    'currentTime' | 'currentHoverTime' | 'setCurrentTime' | 'setCurrentHoverTime'
  > {
  durationMs: number;
  memoryFrames: MemoryFrame[];
  startOffsetMs: number;
}

export default function MemoryChart({
  currentHoverTime,
  currentTime,
  durationMs,
  memoryFrames,
  setCurrentHoverTime,
  setCurrentTime,
  startOffsetMs,
}: Props) {
  const theme = useTheme();

  const chartOptions: Omit<AreaChartProps, 'series'> = useMemo(
    () => ({
      autoHeightResize: true,
      height: 'auto',
      grid: Grid({
        // makes space for the title
        top: '40px',
        left: space(1),
        right: space(1),
      }),
      tooltip: ChartTooltip({
        appendToBody: true,
        trigger: 'axis',
        renderMode: 'html',
        chartId: 'replay-memory-chart',
        formatter: values => {
          const firstValue = Array.isArray(values) ? values[0] : values;
          const seriesTooltips = toArray(values).map(
            value => `
              <div>
                <span className="tooltip-label">${value.marker}<strong>${value.seriesName}</strong></span>
                ${formatBytesBase2(value.data[1])}
              </div>
            `
          );
          return `
            <div class="tooltip-series">${seriesTooltips.join('')}</div>
              <div class="tooltip-footer">
                ${t('Date: %s', getFormattedDate(startOffsetMs + firstValue.axisValue, 'MMM D, YYYY hh:mm:ss A z', {local: false}))}
              </div>
              <div class="tooltip-footer" style="border: none;">
                ${t('Time within replay: %s', formatTime(firstValue.axisValue))}
              </div>
            <div class="tooltip-arrow"></div>
          `;
        },
      }),
      xAxis: XAxis({
        type: 'time',
        axisLabel: {
          formatter: (time: number) => formatTime(time, false),
        },
        theme,
      }),
      yAxis: YAxis({
        type: 'value',
        name: t('Heap Size'),
        theme,
        nameTextStyle: {
          padding: [8, 8, 8, -25],
          fontSize: theme.fontSizeLarge,
          fontWeight: 600,
          lineHeight: 1.2,
          fontFamily: theme.text.family,
          color: theme.gray300,
        },
        // input is in bytes, minInterval is a megabyte
        minInterval: 1024 * 1024,
        // maxInterval is a terabyte
        maxInterval: Math.pow(1024, 4),
        // format the axis labels to be whole number values
        axisLabel: {
          formatter: value => formatBytesBase2(value, 0),
        },
      }),
      onMouseOver: ({data}) => {
        if (data[0]) {
          setCurrentHoverTime(data[0]);
        }
      },
      onMouseOut: () => {
        setCurrentHoverTime(undefined);
      },
      onClick: ({data}) => {
        if (data.value) {
          setCurrentTime(data.value);
        }
      },
    }),
    [setCurrentHoverTime, setCurrentTime, startOffsetMs, theme]
  );

  const staticSeries: Series[] = useMemo(
    () => [
      {
        id: 'usedMemory',
        seriesName: t('Used Heap Memory'),
        data: memoryFrames.map(frame => ({
          value: frame.data.memory.usedJSHeapSize,
          name: frame.offsetMs,
        })),
        stack: 'heap-memory',
        lineStyle: {opacity: 0, width: 2},
      },
      {
        id: 'freeMemory',
        seriesName: t('Free Heap Memory'),
        data: memoryFrames.map(frame => ({
          value: frame.data.memory.totalJSHeapSize - frame.data.memory.usedJSHeapSize,
          name: frame.offsetMs,
        })),
        stack: 'heap-memory',
        lineStyle: {opacity: 0, width: 2},
      },
      {
        id: 'replayStart',
        seriesName: 'Replay Start',
        data: [{value: 0, name: 0}],
        lineStyle: {opacity: 0, width: 0},
      },
      {
        id: 'replayEnd',
        seriesName: 'Replay End',
        data: [{value: 0, name: durationMs}],
        lineStyle: {opacity: 0, width: 0},
      },
    ],
    [durationMs, memoryFrames]
  );

  const currentTimeSeries = useMemo(
    (): Series => ({
      id: 'currentTime',
      seriesName: t('Current player time'),
      data: [],
      markLine: {
        symbol: ['', ''],
        data: [{xAxis: currentTime}],
        label: {show: false},
        lineStyle: {type: 'solid', color: theme.purple300, width: 2},
      },
    }),

    [currentTime, theme.purple300]
  );

  const hoverTimeSeries = useMemo(
    (): Series => ({
      id: 'hoverTime',
      seriesName: t('Hover player time'),
      data: [],
      markLine: {
        symbol: ['', ''],
        data: currentHoverTime ? [{xAxis: currentHoverTime}] : [],
        label: {show: false},
        lineStyle: {type: 'solid', color: theme.purple200, width: 2},
      },
    }),
    [currentHoverTime, theme.purple200]
  );

  return (
    <div id="replay-memory-chart">
      <AreaChart
        autoHeightResize
        height="auto"
        series={staticSeries.concat(currentTimeSeries, hoverTimeSeries)}
        {...chartOptions}
      />
    </div>
  );
}
