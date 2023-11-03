import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart, LineChartSeries} from 'sentry/components/charts/lineChart';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageFilters} from 'sentry/types';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getPeriod} from 'sentry/utils/getPeriod';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {MiniAggregateWaterfall} from 'sentry/views/performance/browser/webVitals/components/miniAggregateWaterfall';
import PerformanceScoreRingWithTooltips from 'sentry/views/performance/browser/webVitals/components/performanceScoreRingWithTooltips';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {useProjectWebVitalsValuesTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsValuesTimeseriesQuery';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';

const CHART_HEIGHTS = 100;

type Props = {
  transaction: string;
  projectScore?: ProjectScore;
  search?: string;
};

export function PageOverviewSidebar({projectScore, transaction}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const pageFilters = usePageFilters();
  const {period, start, end, utc} = pageFilters.selection.datetime;
  const doubledPeriod = getPeriod({period, start, end}, {shouldDoublePeriod: true});
  const doubledDatetime: PageFilters['datetime'] = {
    period: doubledPeriod.statsPeriod ?? null,
    start: doubledPeriod.start ?? null,
    end: doubledPeriod.end ?? null,
    utc,
  };

  const {data, isLoading: isLoading} = useProjectWebVitalsValuesTimeseriesQuery({
    transaction,
    datetime: doubledDatetime,
  });

  let seriesData = !isLoading
    ? data?.count.map(({name, value}) => ({
        name,
        value,
      }))
    : [];

  // Trim off last data point since it's incomplete
  if (seriesData.length > 0 && period && !start && !end) {
    seriesData = seriesData.slice(0, -1);
  }
  const dataMiddleIndex = Math.floor(seriesData.length / 2);
  const currentSeries = seriesData.slice(dataMiddleIndex);
  const previousSeries = seriesData.slice(0, dataMiddleIndex);

  const initialCount = !isLoading
    ? previousSeries.reduce((acc, {value}) => acc + value, 0)
    : undefined;
  const currentCount = !isLoading
    ? currentSeries.reduce((acc, {value}) => acc + value, 0)
    : undefined;
  const countDiff =
    !isLoading && currentCount !== undefined && initialCount !== undefined
      ? currentCount / initialCount
      : undefined;

  const throughtputData: LineChartSeries[] = [
    {
      data: currentSeries,
      seriesName: t('Page Loads'),
    },
  ];

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

  const ringSegmentColors = theme.charts.getColorPalette(3);
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);
  const performanceScoreSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';

  return (
    <Fragment>
      <SectionHeading>
        {t('Performance Score')}
        <QuestionTooltip
          isHoverable
          size="sm"
          title={
            <span>
              {t('The overall performance rating of this page.')}
              <br />
              <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/#performance-score">
                {t('How is this calculated?')}
              </ExternalLink>
            </span>
          }
        />
      </SectionHeading>
      <PerformanceScoreSubText>{performanceScoreSubtext}</PerformanceScoreSubText>
      <SidebarPerformanceScoreRingContainer>
        {projectScore && (
          <PerformanceScoreRingWithTooltips
            projectScore={projectScore}
            text={projectScore.totalScore}
            width={220}
            height={160}
            ringBackgroundColors={ringBackgroundColors}
            ringSegmentColors={ringSegmentColors}
          />
        )}
      </SidebarPerformanceScoreRingContainer>
      <SidebarSpacer />
      <SectionHeading>
        {t('Page Loads')}
        <QuestionTooltip
          size="sm"
          title={t('The total number of times that users have loaded this page.')}
        />
      </SectionHeading>
      <ChartValue>
        {currentCount ? formatAbbreviatedNumber(currentCount) : null}
      </ChartValue>
      {initialCount && currentCount && countDiff && (
        <ChartSubText color={diffToColor(countDiff)}>
          {getChartSubText(
            countDiff,
            formatAbbreviatedNumber(initialCount),
            formatAbbreviatedNumber(currentCount)
          )}
        </ChartSubText>
      )}
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
            yAxis={{axisLabel: {formatter: number => formatAbbreviatedNumber(number)}}}
            tooltip={{valueFormatter: number => formatAbbreviatedNumber(number)}}
          />
        )}
      </ChartZoom>
      <SidebarSpacer />
      <SectionHeading>
        {t('Aggregate Spans')}
        <QuestionTooltip
          size="sm"
          title={t('A synthesized span waterfall for this page.')}
        />
      </SectionHeading>
      <MiniAggregateWaterfallContainer>
        <MiniAggregateWaterfall transaction={transaction} />
      </MiniAggregateWaterfallContainer>
      <SidebarSpacer />
    </Fragment>
  );
}

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

const SidebarPerformanceScoreRingContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: ${space(1)};
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

const PerformanceScoreSubText = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;
