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
import {getFormattedDate} from 'sentry/utils/dates';
import {axisLabelFormatter} from 'sentry/utils/discover/charts';
import type {DomNodeChartDatapoint} from 'sentry/utils/replays/countDomNodes';
import toArray from 'sentry/utils/toArray';

interface Props
  extends Pick<
    ReturnType<typeof useReplayContext>,
    'currentTime' | 'currentHoverTime' | 'setCurrentTime' | 'setCurrentHoverTime'
  > {
  datapoints: DomNodeChartDatapoint[];
  durationMs: number;
  startOffsetMs: number;
  startTimestampMs: number;
}

export default function DomNodesChart({
  currentHoverTime,
  currentTime,
  durationMs,
  datapoints,
  setCurrentHoverTime,
  setCurrentTime,
  startOffsetMs,
  startTimestampMs,
}: Props) {
  const theme = useTheme();

  const chartOptions: Omit<AreaChartProps, 'series'> = {
    autoHeightResize: true,
    height: 'auto',
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
        const firstValue = Array.isArray(values) ? values[0] : values;
        const seriesTooltips = toArray(values).map(
          value => `
            <div>
              <span className="tooltip-label">${value.marker}<strong>${value.seriesName}</strong></span>
              ${value.data[1]}
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
  };

  const staticSeries: Series[] = useMemo(
    () => [
      {
        id: 'nodeCount',
        seriesName: t('Number of DOM nodes'),
        data: datapoints.map(d => ({
          value: d.count,
          name: d.endTimestampMs - startTimestampMs,
        })),
        stack: 'dom-nodes',
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
    [datapoints, durationMs, startTimestampMs]
  );

  const dynamicSeries = useMemo(
    (): Series[] => [
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
    ],
    [currentHoverTime, currentTime, theme.purple200, theme.purple300]
  );

  const series = useMemo(
    () => staticSeries.concat(dynamicSeries),
    [dynamicSeries, staticSeries]
  );

  return <AreaChart series={series} {...chartOptions} />;
}
