import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ChartZoom from 'sentry/components/charts/chartZoom';
import MarkArea from 'sentry/components/charts/components/markArea';
import MarkLine from 'sentry/components/charts/components/markLine';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import getDuration from 'sentry/utils/duration/getDuration';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {
  PERFORMANCE_SCORE_MEDIANS,
  PERFORMANCE_SCORE_P90S,
} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';

interface Props {
  webVitalSeries: LineChartSeries;
}

export function WebVitalStatusLineChart({webVitalSeries}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const pageFilters = usePageFilters();
  const {period, start, end, utc} = pageFilters.selection.datetime;

  const webVital = webVitalSeries.seriesName;
  const allSeries = [webVitalSeries];

  const showPoorMarkLine = webVitalSeries.data?.some(
    ({value}) => value > PERFORMANCE_SCORE_MEDIANS[webVital ?? '']
  );
  const showMehMarkLine = webVitalSeries.data?.some(
    ({value}) => value >= PERFORMANCE_SCORE_P90S[webVital ?? '']
  );
  const showGoodMarkLine = webVitalSeries.data?.every(
    ({value}) => value < PERFORMANCE_SCORE_P90S[webVital ?? '']
  );
  const goodMarkArea = MarkArea({
    silent: true,
    itemStyle: {
      color: theme.green300,
      opacity: 0.1,
    },
    data: [
      [
        {
          yAxis: PERFORMANCE_SCORE_P90S[webVital ?? ''],
        },
        {
          yAxis: 0,
        },
      ],
    ],
  });
  const mehMarkArea = MarkArea({
    silent: true,
    itemStyle: {
      color: theme.yellow300,
      opacity: 0.1,
    },
    data: [
      [
        {
          yAxis: PERFORMANCE_SCORE_MEDIANS[webVital ?? ''],
        },
        {
          yAxis: PERFORMANCE_SCORE_P90S[webVital ?? ''],
        },
      ],
    ],
  });
  const poorMarkArea = MarkArea({
    silent: true,
    itemStyle: {
      color: theme.red300,
      opacity: 0.1,
    },
    data: [
      [
        {
          yAxis: PERFORMANCE_SCORE_MEDIANS[webVital ?? ''],
        },
        {
          yAxis: Infinity,
        },
      ],
    ],
  });
  const goodMarkLine = MarkLine({
    silent: true,
    lineStyle: {
      color: theme.green300,
    },
    label: {
      formatter: () => 'Good',
      position: 'insideEndBottom',
      color: theme.green300,
    },
    data: showGoodMarkLine
      ? [
          [
            {xAxis: 'min', y: 10},
            {xAxis: 'max', y: 10},
          ],
        ]
      : [
          {
            yAxis: PERFORMANCE_SCORE_P90S[webVital ?? ''],
          },
        ],
  });
  const mehMarkLine = MarkLine({
    silent: true,
    lineStyle: {
      color: theme.yellow300,
    },
    label: {
      formatter: () => 'Meh',
      position: 'insideEndBottom',
      color: theme.yellow300,
    },
    data:
      showMehMarkLine && !showPoorMarkLine
        ? [
            [
              {xAxis: 'min', y: 10},
              {xAxis: 'max', y: 10},
            ],
          ]
        : [
            {
              yAxis: PERFORMANCE_SCORE_MEDIANS[webVital ?? ''],
            },
          ],
  });
  const poorMarkLine = MarkLine({
    silent: true,
    lineStyle: {
      color: theme.red300,
    },
    label: {
      formatter: () => 'Poor',
      position: 'insideEndBottom',
      color: theme.red300,
    },
    data: [
      [
        {xAxis: 'min', y: 10},
        {xAxis: 'max', y: 10},
      ],
    ],
  });

  allSeries.push({
    seriesName: '',
    type: 'line',
    markArea: goodMarkArea,
    data: [],
  });

  allSeries.push({
    seriesName: '',
    type: 'line',
    markArea: mehMarkArea,
    data: [],
  });

  allSeries.push({
    seriesName: '',
    type: 'line',
    markArea: poorMarkArea,
    data: [],
  });

  allSeries.push({
    seriesName: '',
    type: 'line',
    markLine: goodMarkLine,
    data: [],
  });

  allSeries.push({
    seriesName: '',
    type: 'line',
    markLine: mehMarkLine,
    data: [],
  });

  if (showPoorMarkLine) {
    allSeries.push({
      seriesName: '',
      type: 'line',
      markLine: poorMarkLine,
      data: [],
    });
  }

  const getFormattedDuration = (value: number) => {
    if (value < 1000) {
      return getDuration(value / 1000, 0, true);
    }
    return getDuration(value / 1000, 2, true);
  };

  return (
    <ChartContainer>
      {webVital && (
        <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
          {zoomRenderProps => (
            <LineChart
              {...zoomRenderProps}
              height={240}
              series={allSeries}
              xAxis={{show: false}}
              grid={{
                left: 0,
                right: 15,
                top: 10,
                bottom: 0,
              }}
              yAxis={
                webVital === 'cls' ? {} : {axisLabel: {formatter: getFormattedDuration}}
              }
              tooltip={webVital === 'cls' ? {} : {valueFormatter: getFormattedDuration}}
            />
          )}
        </ChartZoom>
      )}
    </ChartContainer>
  );
}

const ChartContainer = styled('div')`
  position: relative;
  flex: 1;
`;
