import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ChartZoom from 'sentry/components/charts/chartZoom';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MiniAggregateWaterfall} from 'sentry/views/insights/browser/webVitals/components/miniAggregateWaterfall';
import PerformanceScoreRingWithTooltips from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import {useProjectRawWebVitalsValuesTimeseriesQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsValuesTimeseriesQuery';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';
import type {ProjectScore} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import type {SubregionCode} from 'sentry/views/insights/types';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';

const CHART_HEIGHTS = 100;

type Props = {
  transaction: string;
  browserTypes?: BrowserType[];
  projectScore?: ProjectScore;
  projectScoreIsLoading?: boolean;
  search?: string;
  subregions?: SubregionCode[];
};

export function PageOverviewSidebar({
  projectScore,
  transaction,
  projectScoreIsLoading,
  browserTypes,
  subregions,
}: Props) {
  const theme = useTheme();
  const pageFilters = usePageFilters();
  const {period, start, end, utc} = pageFilters.selection.datetime;
  const shouldDoublePeriod = shouldFetchPreviousPeriod({
    includePrevious: true,
    period,
    start,
    end,
  });
  const doubledPeriod = getPeriod({period, start, end}, {shouldDoublePeriod});
  const doubledDatetime: PageFilters['datetime'] = {
    period: doubledPeriod.statsPeriod ?? null,
    start: doubledPeriod.start ?? null,
    end: doubledPeriod.end ?? null,
    utc,
  };

  const {data, isLoading: isLoading} = useProjectRawWebVitalsValuesTimeseriesQuery({
    transaction,
    datetime: doubledDatetime,
    browserTypes,
    subregions,
  });

  const {countDiff, currentSeries, currentCount, initialCount} = processSeriesData(
    data?.count,
    isLoading,
    pageFilters.selection.datetime,
    shouldDoublePeriod
  );

  const throughtputData: LineChartSeries[] = [
    {
      data: currentSeries,
      seriesName: t('Page Loads'),
    },
  ];

  const {
    countDiff: inpCountDiff,
    currentSeries: currentInpSeries,
    currentCount: currentInpCount,
    initialCount: initialInpCount,
  } = processSeriesData(
    data.countInp,
    isLoading,
    pageFilters.selection.datetime,
    shouldDoublePeriod
  );

  const inpThroughtputData: LineChartSeries[] = [
    {
      data: currentInpSeries,
      seriesName: t('Interactions'),
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

  const ringSegmentColors = theme.charts.getColorPalette(3) ?? [];
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

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
              <ExternalLink href={`${MODULE_DOC_LINK}#performance-score`}>
                {t('How is this calculated?')}
              </ExternalLink>
            </span>
          }
        />
      </SectionHeading>
      <SidebarPerformanceScoreRingContainer>
        {!projectScoreIsLoading && projectScore && (
          <PerformanceScoreRingWithTooltips
            projectScore={projectScore}
            text={projectScore.totalScore}
            width={220}
            height={200}
            ringBackgroundColors={ringBackgroundColors}
            ringSegmentColors={ringSegmentColors}
          />
        )}
        {projectScoreIsLoading && <ProjectScoreEmptyLoadingElement />}
      </SidebarPerformanceScoreRingContainer>
      <SidebarSpacer />
      <SectionHeading>
        {t('Page Loads')}
        <QuestionTooltip
          size="sm"
          title={t(
            'The total number of times that users have loaded this page. This number does not include any page navigations beyond initial page loads.'
          )}
        />
      </SectionHeading>
      <ChartValue>
        {currentCount ? formatAbbreviatedNumber(currentCount) : null}
      </ChartValue>
      {initialCount && currentCount && countDiff && shouldDoublePeriod ? (
        <ChartSubText color={diffToColor(countDiff)}>
          {getChartSubText(
            countDiff,
            formatAbbreviatedNumber(initialCount),
            formatAbbreviatedNumber(currentCount)
          )}
        </ChartSubText>
      ) : null}
      <ChartZoom period={period} start={start} end={end} utc={utc}>
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
      <MiniAggregateWaterfallContainer>
        <MiniAggregateWaterfall transaction={transaction} />
      </MiniAggregateWaterfallContainer>
      <SidebarSpacer />
      <SidebarSpacer />
      <SectionHeading>
        {t('Interactions')}
        <QuestionTooltip
          size="sm"
          title={t('The total number of times that users performed an INP on this page.')}
        />
      </SectionHeading>
      <ChartValue>
        {currentInpCount ? formatAbbreviatedNumber(currentInpCount) : null}
      </ChartValue>
      {initialInpCount && currentInpCount && inpCountDiff && shouldDoublePeriod ? (
        <ChartSubText color={diffToColor(inpCountDiff)}>
          {getChartSubText(
            inpCountDiff,
            formatAbbreviatedNumber(initialInpCount),
            formatAbbreviatedNumber(currentInpCount)
          )}
        </ChartSubText>
      ) : null}
      <ChartZoom period={period} start={start} end={end} utc={utc}>
        {zoomRenderProps => (
          <LineChart
            {...zoomRenderProps}
            height={CHART_HEIGHTS}
            series={inpThroughtputData}
            xAxis={{show: false}}
            grid={{
              left: 0,
              right: 15,
              top: 10,
              bottom: -10,
            }}
            yAxis={{
              axisLabel: {formatter: number => formatAbbreviatedNumber(number)},
            }}
            tooltip={{valueFormatter: number => formatAbbreviatedNumber(number)}}
          />
        )}
      </ChartZoom>
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

const processSeriesData = (
  count: SeriesDataUnit[],
  isLoading: boolean,
  {period, start, end}: PageFilters['datetime'],
  shouldDoublePeriod: boolean
) => {
  let seriesData = !isLoading
    ? count.map(({name, value}) => ({
        name,
        value,
      }))
    : [];

  // Trim off last data point since it's incomplete
  if (seriesData.length > 0 && period && !start && !end) {
    seriesData = seriesData.slice(0, -1);
  }
  const dataMiddleIndex = Math.floor(seriesData.length / 2);
  const currentSeries = shouldDoublePeriod
    ? seriesData.slice(dataMiddleIndex)
    : seriesData;
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

  return {countDiff, currentSeries, currentCount, initialCount};
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

const ProjectScoreEmptyLoadingElement = styled('div')`
  width: 220px;
  height: 160px;
`;
