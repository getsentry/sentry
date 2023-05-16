import {forwardRef, memo, useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import Grid from 'sentry/components/charts/components/grid';
import {ChartTooltip} from 'sentry/components/charts/components/tooltip';
import XAxis from 'sentry/components/charts/components/xAxis';
import YAxis from 'sentry/components/charts/components/yAxis';
import EmptyMessage from 'sentry/components/emptyMessage';
import Placeholder from 'sentry/components/placeholder';
import {showPlayerTime} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ReactEchartsRef, Series} from 'sentry/types/echarts';
import {formatBytesBase2} from 'sentry/utils';
import {getFormattedDate} from 'sentry/utils/dates';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import type {MemorySpan} from 'sentry/views/replays/types';

interface Props {
  memorySpans: undefined | MemorySpan[];
  setCurrentHoverTime: (time: undefined | number) => void;
  setCurrentTime: (time: number) => void;
  startTimestampMs: undefined | number;
}

interface MemoryChartProps extends Props {
  forwardedRef: React.Ref<ReactEchartsRef>;
}

const formatTimestamp = timestamp =>
  getFormattedDate(timestamp * 1000, 'MMM D, YYYY hh:mm:ss A z', {local: false});

function MemoryChart({
  forwardedRef,
  memorySpans,
  startTimestampMs = 0,
  setCurrentTime,
  setCurrentHoverTime,
}: MemoryChartProps) {
  const theme = useTheme();

  if (!memorySpans) {
    return (
      <MemoryChartWrapper>
        <Placeholder height="100%" />
      </MemoryChartWrapper>
    );
  }

  if (memorySpans.length <= 0) {
    return (
      <EmptyMessage
        title={t('No memory metrics found')}
        description={t(
          'Memory metrics are only captured within Chromium based browser sessions.'
        )}
      />
    );
  }

  const chartOptions: Omit<AreaChartProps, 'series'> = {
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
        const seriesTooltips = values.map(
          value => `
            <div>
              <span className="tooltip-label">${value.marker}<strong>${
            value.seriesName
          }</strong></span>
          ${formatBytesBase2(value.data[1])}
            </div>
          `
        );
        // showPlayerTime expects a timestamp so we take the captured time in seconds and convert it to a UTC timestamp
        const template = [
          '<div class="tooltip-series">',
          ...seriesTooltips,
          '</div>',
          `<div class="tooltip-footer" style="display: inline-block; width: max-content;">${t(
            'Span Time'
          )}:
            ${formatTimestamp(values[0].axisValue)}
          </div>`,
          `<div class="tooltip-footer" style="border: none;">${'Relative Time'}:
            ${showPlayerTime(
              moment(values[0].axisValue * 1000)
                .toDate()
                .toUTCString(),
              startTimestampMs
            )}
          </div>`,
          '<div class="tooltip-arrow"></div>',
        ].join('');
        return template;
      },
    }),
    xAxis: XAxis({
      type: 'time',
      axisLabel: {
        formatter: formatTimestamp,
      },
      theme,
    }),
    yAxis: YAxis({
      type: 'value',
      name: t('Heap Size'),
      theme,
      nameTextStyle: {
        padding: 8,
        fontSize: theme.fontSizeLarge,
        fontWeight: 600,
        lineHeight: 1.2,
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

    // XXX: For area charts, mouse events *only* occurs when interacting with
    // the "line" of the area chart. Mouse events do not fire when interacting
    // with the "area" under the line.
    onMouseOver: ({data}) => {
      if (data[0]) {
        setCurrentHoverTime(data[0] * 1000 - startTimestampMs);
      }
    },
    onMouseOut: () => {
      setCurrentHoverTime(undefined);
    },
    onClick: ({data}) => {
      if (data.value) {
        setCurrentTime(data.value * 1000 - startTimestampMs);
      }
    },
  };

  const series: Series[] = [
    {
      seriesName: t('Used Heap Memory'),
      data: memorySpans.map(span => ({
        value: span.data.memory.usedJSHeapSize,
        name: span.endTimestamp,
      })),
      stack: 'heap-memory',
      lineStyle: {
        opacity: 0.75,
        width: 1,
      },
    },
    {
      seriesName: t('Free Heap Memory'),
      data: memorySpans.map(span => ({
        value: span.data.memory.totalJSHeapSize - span.data.memory.usedJSHeapSize,
        name: span.endTimestamp,
      })),
      stack: 'heap-memory',
      lineStyle: {
        opacity: 0.75,
        width: 1,
      },
    },

    // Inserting this here so we can update in Container
    {
      id: 'currentTime',
      seriesName: t('Current player time'),
      data: [],
      markLine: {
        symbol: ['', ''],
        data: [],
        label: {
          show: false,
        },
        lineStyle: {
          type: 'solid' as const,
          color: theme.purple300,
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
        label: {
          show: false,
        },
        lineStyle: {
          type: 'solid' as const,
          color: theme.purple200,
          width: 2,
        },
      },
    },
  ];

  return (
    <MemoryChartWrapper id="replay-memory-chart">
      <AreaChart forwardedRef={forwardedRef} series={series} {...chartOptions} />
    </MemoryChartWrapper>
  );
}

const MemoryChartWrapper = styled(FluidHeight)`
  margin-bottom: ${space(3)};
  border-radius: ${space(0.5)};
  border: 1px solid ${p => p.theme.border};
`;

const MemoizedMemoryChart = memo(
  forwardRef<ReactEchartsRef, Props>((props, ref) => (
    <MemoryChart forwardedRef={ref} {...props} />
  ))
);

interface MemoryChartContainerProps extends Props {
  currentHoverTime: number | undefined;
  currentTime: number;
}

/**
 * This container is used to update echarts outside of React. `currentTime` is
 * the current time of the player -- if replay is currently playing, this will be
 * updated quite frequently causing the chart to constantly re-render. The
 * re-renders will conflict with mouse interactions (e.g. hovers and
 * tooltips).
 *
 * We need `MemoryChart` (which wraps an `<AreaChart>`) to re-render as
 * infrequently as possible, so we use React.memo and only pass in props that
 * are not frequently updated.
 * */
function MemoryChartContainer({
  currentTime,
  currentHoverTime,
  startTimestampMs = 0,
  ...props
}: MemoryChartContainerProps) {
  const chart = useRef<ReactEchartsRef>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!chart.current) {
      return;
    }
    const echarts = chart.current.getEchartsInstance();

    echarts.setOption({
      series: [
        {
          id: 'currentTime',
          markLine: {
            data: [
              {
                xAxis: currentTime + startTimestampMs,
              },
            ],
          },
        },
      ],
    });
  }, [currentTime, startTimestampMs, theme]);

  useEffect(() => {
    if (!chart.current) {
      return;
    }
    const echarts = chart.current.getEchartsInstance();

    echarts.setOption({
      series: [
        {
          id: 'hoverTime',
          markLine: {
            data: [
              ...(currentHoverTime
                ? [
                    {
                      xAxis: currentHoverTime + startTimestampMs,
                    },
                  ]
                : []),
            ],
          },
        },
      ],
    });
  }, [currentHoverTime, startTimestampMs, theme]);

  return (
    <MemoizedMemoryChart ref={chart} startTimestampMs={startTimestampMs} {...props} />
  );
}

export default MemoryChartContainer;
