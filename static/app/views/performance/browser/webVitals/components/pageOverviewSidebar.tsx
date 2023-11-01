import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart, LineChartSeries} from 'sentry/components/charts/lineChart';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {MiniAggregateWaterfall} from 'sentry/views/performance/browser/webVitals/components/miniAggregateWaterfall';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {useProjectWebVitalsValuesTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsValuesTimeseriesQuery';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';

const CHART_HEIGHTS = 100;

type Props = {
  transaction: string;
  projectScore?: ProjectScore;
};

export function PageOverviewSidebar({projectScore, transaction}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const pageFilters = usePageFilters();
  const {period, start, end, utc} = pageFilters.selection.datetime;

  const {data: pageData} = useProjectWebVitalsQuery({transaction});

  const {data: seriesData, isLoading: isLoadingSeries} =
    useProjectWebVitalsValuesTimeseriesQuery({transaction});

  const throughtputData: LineChartSeries[] = [
    {
      data: !isLoadingSeries
        ? seriesData.eps.map(({name, value}) => ({
            name,
            value,
          }))
        : [],
      seriesName: 'Throughput',
    },
  ];

  const durationData: LineChartSeries[] = [
    {
      data: !isLoadingSeries
        ? seriesData.duration.map(({name, value}) => ({
            name,
            value,
          }))
        : [],
      seriesName: 'Duration',
    },
  ];

  const errorData: LineChartSeries[] = [
    {
      data: !isLoadingSeries
        ? seriesData.errors.map(({name, value}) => ({
            name,
            value,
          }))
        : [],
      seriesName: '5XX Responses',
    },
  ];

  const epsDiff = !isLoadingSeries
    ? seriesData.eps[seriesData.eps.length - 1].value / seriesData.eps[0].value
    : undefined;
  const initialEps = !isLoadingSeries
    ? `${Math.round(seriesData.eps[0].value * 100) / 100}/s`
    : undefined;
  const currentEps = !isLoadingSeries
    ? `${Math.round(seriesData.eps[seriesData.eps.length - 1].value * 100) / 100}/s`
    : undefined;

  const durationDiff = !isLoadingSeries
    ? seriesData.duration[seriesData.duration.length - 1].value /
      seriesData.duration[0].value
    : undefined;
  const initialDuration = !isLoadingSeries
    ? getDuration(seriesData.duration[0].value / 1000, 2, true)
    : undefined;
  const currentDuration = !isLoadingSeries
    ? getDuration(
        seriesData.duration[seriesData.duration.length - 1].value / 1000,
        2,
        true
      )
    : undefined;

  const diffToColor = (diff?: number, reverse?: boolean) => {
    if (diff === undefined) {
      return undefined;
    }
    if (diff > 1) {
      if (reverse) {
        return theme.red300;
      }
      return theme.green300;
    }
    if (diff < 1) {
      if (reverse) {
        return theme.green300;
      }
      return theme.red300;
    }
    return undefined;
  };

  return (
    <Fragment>
      <SectionHeading>
        {t('Performance Score')}
        <QuestionTooltip
          size="sm"
          title={t('Overall performance rating of your application')}
        />
      </SectionHeading>
      <SidebarPerformanceScoreValue>
        {projectScore?.totalScore ?? '-'}
      </SidebarPerformanceScoreValue>
      <SidebarSpacer />
      <SectionHeading>
        {t('Throughput')}
        {/* TODO: Add a proper tooltip */}
        <QuestionTooltip
          size="sm"
          title={t('The number of transactions per unit time')}
        />
      </SectionHeading>
      <ChartValue>{currentEps}</ChartValue>
      <ChartSubText color={diffToColor(epsDiff)}>
        {getChartSubText(epsDiff, initialEps, currentEps)}
      </ChartSubText>
      <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
        {zoomRenderProps => (
          <LineChart
            {...zoomRenderProps}
            height={CHART_HEIGHTS}
            series={throughtputData}
            xAxis={{show: false}}
            grid={{
              left: 0,
              right: 15,
              top: 10,
              bottom: -10,
            }}
            yAxis={{axisLabel: {formatter: value => `${value}/s`}}}
            tooltip={{valueFormatter: value => `${Math.round(value * 100) / 100}/s`}}
          />
        )}
      </ChartZoom>
      <SidebarSpacer />
      <SectionHeading>
        {t('Duration (P75)')}
        {/* TODO: Add a proper tooltip */}
        <QuestionTooltip
          size="sm"
          title={t(
            'Metric indicating a duration that 25% of all transaction durations exceed'
          )}
        />
      </SectionHeading>
      <ChartValue>{currentDuration}</ChartValue>
      <ChartSubText color={diffToColor(durationDiff, true)}>
        {getChartSubText(durationDiff, initialDuration, currentDuration)}
      </ChartSubText>
      <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
        {zoomRenderProps => (
          <LineChart
            {...zoomRenderProps}
            height={CHART_HEIGHTS}
            series={durationData}
            xAxis={{show: false}}
            grid={{
              left: 0,
              right: 15,
              top: 10,
              bottom: -10,
            }}
            yAxis={{axisLabel: {formatter: getAxisLabelFormattedDuration}}}
            tooltip={{valueFormatter: getFormattedDuration}}
          />
        )}
      </ChartZoom>
      <SidebarSpacer />
      <SectionHeading>
        {t('5XX Responses')}
        {/* TODO: Add a proper tooltip */}
        <QuestionTooltip
          size="sm"
          title={t('The count of responses with server errors')}
        />
      </SectionHeading>
      <ChartValue>{pageData?.data[0]['failure_count()']}</ChartValue>
      <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
        {zoomRenderProps => (
          <LineChart
            {...zoomRenderProps}
            height={CHART_HEIGHTS}
            series={errorData}
            xAxis={{show: false}}
            grid={{
              left: 0,
              right: 15,
              top: 10,
              bottom: -10,
            }}
          />
        )}
      </ChartZoom>
      <SidebarSpacer />
      <SectionHeading>
        {t('Aggregate Spans')}
        {/* TODO: Add a proper tooltip */}
        <QuestionTooltip
          size="sm"
          title={t('Waterfall view displaying common span paths that the page may take')}
        />
      </SectionHeading>
      <MiniAggregateWaterfallContainer>
        <MiniAggregateWaterfall transaction={transaction} />
      </MiniAggregateWaterfallContainer>
    </Fragment>
  );
}

const getFormattedDuration = (value: number) => {
  if (value < 1000) {
    return getDuration(value / 1000, 0, true);
  }
  return getDuration(value / 1000, 2, true);
};

const getAxisLabelFormattedDuration = (value: number) => {
  return getDuration(value / 1000, 0, true);
};

const getChartSubText = (
  diff?: number,
  value?: string | number,
  newValue?: string | number
) => {
  if (diff === undefined || value === undefined) {
    return null;
  }
  if (diff > 1) {
    const relativeDiff = Math.round((diff - 1) * 1000) / 10;
    if (relativeDiff === Infinity) {
      return `Up from ${value} to ${newValue}`;
    }
    return `Up ${relativeDiff}% from ${value}`;
  }
  if (diff < 1) {
    const relativeDiff = Math.round((1 - diff) * 1000) / 10;
    return `Down ${relativeDiff}% from ${value}`;
  }
  return t('No Change');
};

const SidebarPerformanceScoreValue = styled('div')`
  font-weight: bold;
  font-size: 32px;
`;

const ChartValue = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const ChartSubText = styled('div')<{color?: string}>`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.color ?? p.theme.subText};
`;

const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;

const MiniAggregateWaterfallContainer = styled('div')`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;
