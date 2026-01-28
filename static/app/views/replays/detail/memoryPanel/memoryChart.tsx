import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react';
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
import type {ReactEchartsRef} from 'sentry/types/echarts';
import toArray from 'sentry/utils/array/toArray';
import {formatBytesBase2} from 'sentry/utils/bytes/formatBytesBase2';
import {getFormat, getFormattedDate} from 'sentry/utils/dates';
import formatDuration from 'sentry/utils/duration/formatDuration';
import type {MemoryFrame} from 'sentry/utils/replays/types';

interface Props
  extends MemoryChartSeriesProps,
    Pick<ReturnType<typeof useReplayContext>, 'currentTime' | 'setCurrentTime'> {
  currentHoverTime: undefined | number;
  setCurrentHoverTime: Dispatch<SetStateAction<number | undefined>>;
}

export default function MemoryChart({
  currentHoverTime,
  currentTime,
  setCurrentHoverTime,
  setCurrentTime,
  ...props
}: Props) {
  const chartRef = useRef<ReactEchartsRef | null>(null);

  const handleRef = useCallback(
    (e: ReactEchartsRef | null) => {
      chartRef.current = e;

      if (!e) {
        return;
      }

      const echarts = e.getEchartsInstance();

      echarts.on('mousemove', params => {
        if (!params.event) {
          return;
        }

        const pointInGrid = echarts.convertFromPixel('grid', [
          params.event.offsetX,
          params.event.offsetY,
        ]);
        if (pointInGrid[0] !== undefined) {
          setCurrentHoverTime(pointInGrid[0]);
        }
      });
      echarts.on('mouseout', () => {
        setCurrentHoverTime(undefined);
      });

      echarts.on('click', params => {
        if (!params.event) {
          return;
        }

        const pointInGrid = echarts.convertFromPixel('grid', [
          params.event.offsetX,
          params.event.offsetY,
        ]);
        if (pointInGrid[0] !== undefined) {
          setCurrentTime(pointInGrid[0]);
        }
      });
    },
    [setCurrentTime, setCurrentHoverTime]
  );

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const echarts = chartRef.current.getEchartsInstance();
    echarts.setOption({
      series: [
        {
          id: 'currentTime',
          markLine: {
            data: [{xAxis: currentTime}],
          },
        },
      ],
    });
  }, [currentTime]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const echarts = chartRef.current.getEchartsInstance();
    echarts.setOption({
      series: [
        {
          id: 'hoverTime',
          markLine: {
            data: currentHoverTime ? [{xAxis: currentHoverTime}] : [],
          },
        },
      ],
    });
  }, [currentHoverTime]);

  return <MemoryChartSeries {...props} ref={handleRef} />;
}

interface MemoryChartSeriesProps {
  durationMs: number;
  memoryFrames: MemoryFrame[];
  startTimestampMs: number;
  ref?: React.Ref<ReactEchartsRef>;
}

const MemoryChartSeries = memo(
  ({ref, durationMs, memoryFrames, startTimestampMs}: MemoryChartSeriesProps) => {
    const theme = useTheme();
    const chartId = useId();
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
            chartId,
            formatter: values => {
              const firstValue = Array.isArray(values) ? values[0] : values;
              const seriesTooltips = toArray(values).map(
                value => `
            <div>
              <span className="tooltip-label">${value.marker as string}<strong>${value.seriesName}</strong></span>
              ${formatBytesBase2((value.data as any)[1])}
            </div>
          `
              );
              return `
          <div class="tooltip-series">${seriesTooltips.join('')}</div>
            <div class="tooltip-footer">
              ${t('Date: %s', getFormattedDate(startTimestampMs + (firstValue as any).axisValue, getFormat({year: true, seconds: true, timeZone: true}), {local: false}))}
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
      }),
      [startTimestampMs, theme, chartId]
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
          emphasis: {disabled: true},
          stack: 'heap-memory',
          triggerLineEvent: true,
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
            data: [],
            label: {show: false},
            lineStyle: {
              type: 'solid',
              color: theme.tokens.graphics.accent.vibrant,
              width: 2,
            },
          },
        },
        {
          id: 'hoverTime',
          seriesName: t('Hover player time'),
          data: [],
          markLine: {
            symbol: ['', ''],
            data: [],
            label: {show: false},
            lineStyle: {
              type: 'solid',
              color: theme.tokens.graphics.neutral.moderate,
              width: 2,
            },
          },
        },
      ],
      [theme.tokens.graphics.accent.vibrant, theme.tokens.graphics.neutral.moderate]
    );

    const series = useMemo(
      () => staticSeries.concat(dynamicSeries),
      [dynamicSeries, staticSeries]
    );

    return (
      <div id={chartId}>
        <AreaChart ref={ref} {...chartOptions} series={series} />
      </div>
    );
  }
);
