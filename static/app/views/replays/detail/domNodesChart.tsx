import {forwardRef, memo, useEffect, useMemo, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment';

import {AreaChart, AreaChartProps} from 'sentry/components/charts/areaChart';
import Grid from 'sentry/components/charts/components/grid';
import {ChartTooltip} from 'sentry/components/charts/components/tooltip';
import XAxis from 'sentry/components/charts/components/xAxis';
import YAxis from 'sentry/components/charts/components/yAxis';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {showPlayerTime} from 'sentry/components/replays/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ReactEchartsRef, Series} from 'sentry/types/echarts';
import {getFormattedDate} from 'sentry/utils/dates';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import {useQuery} from 'sentry/utils/queryClient';
import countDomNodes, {DomNodeChartDatapoint} from 'sentry/utils/replays/countDomNodes';
import ReplayReader from 'sentry/utils/replays/replayReader';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  datapoints: DomNodeChartDatapoint[];
  setCurrentHoverTime: (time: undefined | number) => void;
  setCurrentTime: (time: number) => void;
  startTimestampMs: undefined | number;
}

interface DomNodesChartProps extends Props {
  forwardedRef: React.Ref<ReactEchartsRef>;
}

const formatTimestamp = timestamp =>
  getFormattedDate(timestamp, 'MMM D, YYYY hh:mm:ss A z', {local: false});

const formatTimestampTrim = timestamp =>
  getFormattedDate(timestamp, 'MMM D hh:mm', {local: false});

function DomNodesChart({
  forwardedRef,
  datapoints,
  startTimestampMs = 0,
  setCurrentTime,
  setCurrentHoverTime,
}: DomNodesChartProps) {
  const theme = useTheme();

  if (!datapoints) {
    return null;
  }

  if (!datapoints.length) {
    return (
      <DomNodesChartWrapper>
        <Placeholder height="100%" />
      </DomNodesChartWrapper>
    );
  }

  const chartOptions: Omit<AreaChartProps, 'series'> = {
    grid: Grid({
      top: '40px',
      left: space(1),
      right: space(1),
    }),
    tooltip: ChartTooltip({
      appendToBody: true,
      trigger: 'axis',
      renderMode: 'html',
      chartId: 'replay-dom-nodes-chart',
      formatter: values => {
        const seriesTooltips = values.map(
          value => `
            <div>
              <span className="tooltip-label">${value.marker}<strong>${value.seriesName}</strong></span>
          ${value.data[1]}
            </div>
          `
        );
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
              moment(values[0].axisValue).toDate().toUTCString(),
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
        formatter: formatTimestampTrim,
      },
      theme,
    }),
    yAxis: YAxis({
      type: 'value',
      name: t('DOM Nodes'),
      theme,
      nameTextStyle: {
        padding: [8, 8, 8, 48],
        fontSize: theme.fontSizeLarge,
        fontWeight: 600,
        lineHeight: 1.2,
        fontFamily: theme.text.family,
        color: theme.gray300,
      },
      minInterval: 100,
      maxInterval: Math.pow(1024, 4),
      axisLabel: {
        formatter: (value: number) => axisLabelFormatter(value, 'number', true),
      },
    }),
    onMouseOver: ({data}) => {
      if (data[0]) {
        setCurrentHoverTime(data[0] - startTimestampMs);
      }
    },
    onMouseOut: () => {
      setCurrentHoverTime(undefined);
    },
    onClick: ({data}) => {
      if (data.value) {
        setCurrentTime(data.value - startTimestampMs);
      }
    },
  };

  const series: Series[] = [
    {
      seriesName: t('Number of DOM nodes'),
      data: datapoints.map(d => ({
        value: d.count,
        name: d.endTimestampMs,
      })),
      stack: 'dom-nodes',
      lineStyle: {
        opacity: 0.75,
        width: 1,
      },
    },
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
    <DomNodesChartWrapper id="replay-dom-nodes-chart">
      <AreaChart forwardedRef={forwardedRef} series={series} {...chartOptions} />
    </DomNodesChartWrapper>
  );
}

const DomNodesChartWrapper = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${space(0.5)};
  justify-content: center;
  padding: ${space(1)};
`;

const MemoizedDomNodesChart = memo(
  forwardRef<ReactEchartsRef, Props>((props, ref) => (
    <DomNodesChart forwardedRef={ref} {...props} />
  ))
);

function useCountDomNodes({replay}: {replay: null | ReplayReader}) {
  return useQuery(
    ['countDomNodes', replay],
    () =>
      countDomNodes({
        frames: replay?.getRRWebMutations(),
        rrwebEvents: replay?.getRRWebFrames(),
        startTimestampMs: replay?.getReplay().started_at.getTime() ?? 0,
      }),
    {enabled: Boolean(replay), cacheTime: Infinity}
  );
}

function DomNodesChartContainer() {
  const {currentTime, currentHoverTime, replay, setCurrentTime, setCurrentHoverTime} =
    useReplayContext();
  const chart = useRef<ReactEchartsRef>(null);
  const theme = useTheme();
  const {data: frameToCount} = useCountDomNodes({replay});
  const startTimestampMs = replay?.getReplay()?.started_at?.getTime() ?? 0;

  const datapoints = useMemo(
    () => Array.from(frameToCount?.values() || []),
    [frameToCount]
  );

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
    <MemoizedDomNodesChart
      ref={chart}
      datapoints={datapoints}
      setCurrentHoverTime={setCurrentHoverTime}
      setCurrentTime={setCurrentTime}
      startTimestampMs={startTimestampMs}
    />
  );
}

export default DomNodesChartContainer;
