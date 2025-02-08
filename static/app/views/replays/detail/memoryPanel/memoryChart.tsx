import type {Dispatch, SetStateAction} from 'react';
import {useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';

import type {AreaChartProps, AreaChartSeries} from 'sentry/components/charts/areaChart';
import {AreaChart} from 'sentry/components/charts/areaChart';
import Grid from 'sentry/components/charts/components/grid';
import {computeChartTooltip} from 'sentry/components/charts/components/tooltip';
import XAxis from 'sentry/components/charts/components/xAxis';
import YAxis from 'sentry/components/charts/components/yAxis';
import type {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import toArray from 'sentry/utils/array/toArray';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {getFormattedDate} from 'sentry/utils/dates';
import domId from 'sentry/utils/domId';
import formatDuration from 'sentry/utils/duration/formatDuration';
import type {MemoryFrame} from 'sentry/utils/replays/types';

interface Props
  extends Pick<ReturnType<typeof useReplayContext>, 'currentTime' | 'setCurrentTime'> {
  currentHoverTime: undefined | number;
  durationMs: number;
  memoryFrames: MemoryFrame[];
  setCurrentHoverTime: Dispatch<SetStateAction<number | undefined>>;
  startTimestampMs: number;
}

export default function MemoryChart({
  currentHoverTime,
  currentTime,
  durationMs,
  memoryFrames,
  setCurrentHoverTime,
  setCurrentTime,
  startTimestampMs,
}: Props) {
  const theme = useTheme();
  const idRef = useRef(domId('replay-memory-chart-'));

  const chartOptions: Omit<AreaChartProps, 'series'> = useMemo(
    () => ({
      autoHeightResize: true,
      height: 'auto',
      grid: Grid({
        left: space(1),
        right: space(1),
      }),
      tooltip: computeChartTooltip(
        {
          appendToBody: true,
          trigger: 'axis',
          renderMode: 'html',
          chartId: idRef.current,
          formatter: values => {
            const firstValue = Array.isArray(values) ? values[0] : values;
            const seriesTooltips = toArray(values).map(
              value => `
              <div>
                <span className="tooltip-label">${value.marker}<strong>${value.seriesName}</strong></span>
                ${formatBytesBase2((value.data as any)[1])}
              </div>
            `
            );
            return `
            <div class="tooltip-series">${seriesTooltips.join('')}</div>
              <div class="tooltip-footer">
                ${t('Date: %s', getFormattedDate(startTimestampMs + (firstValue as any).axisValue, 'MMM D, YYYY hh:mm:ss A z', {local: false}))}
              </div>
              <div class="tooltip-footer" style="border: none;">
                ${t(
                  'Time within replay: %s',
                  formatDuration({
                    duration: [(firstValue as any).axisValue, 'ms'],
                    precision: 'ms',
                    style: 'hh:mm:ss.sss',
                  })
                )}
              </div>
            <div class="tooltip-arrow"></div>
          `;
          },
        },
        theme
      ),
      xAxis: XAxis({
        type: 'time',
        axisLabel: {
          formatter: (time: number) =>
            formatDuration({
              duration: [time, 'ms'],
              precision: 'sec',
              style: 'hh:mm:ss',
            }),
        },
        theme,
      }),
      yAxis: YAxis({
        type: 'value',
        theme,
        minInterval: 1024 * 1024, // input is in bytes, minInterval is a megabyte
        maxInterval: Math.pow(1024, 4), // maxInterval is a terabyte
        axisLabel: {
          // format the axis labels to be whole number values
          formatter: (value: any) => formatBytesBase2(value, 0),
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
    [setCurrentHoverTime, setCurrentTime, startTimestampMs, theme]
  );

  const staticSeries = useMemo<AreaChartSeries[]>(
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

  const dynamicSeries = useMemo<AreaChartSeries[]>(
    () => [
      {
        id: 'currentTime',
        seriesName: t('Current player time'),
        data: [],
        markLine: {
          symbol: ['', ''],
          data: [{xAxis: currentTime}],
          label: {show: false},
          lineStyle: {type: 'solid', color: theme.purple300, width: 2},
        },
      },
      {
        id: 'hoverTime',
        seriesName: t('Hover player time'),
        data: [],
        markLine: {
          symbol: ['', ''],
          data: currentHoverTime ? [{xAxis: currentHoverTime}] : [],
          label: {show: false},
          lineStyle: {type: 'solid', color: theme.purple200, width: 2},
        },
      },
    ],
    [currentTime, currentHoverTime, theme.purple200, theme.purple300]
  );

  const series = useMemo(
    () => staticSeries.concat(dynamicSeries),
    [dynamicSeries, staticSeries]
  );

  return (
    <div id={idRef.current}>
      <AreaChart series={series} {...chartOptions} />
    </div>
  );
}
