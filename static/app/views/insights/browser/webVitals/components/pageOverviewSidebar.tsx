import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ChartZoom from 'sentry/components/charts/chartZoom';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {Link} from 'sentry/components/core/link';
import ExternalLink from 'sentry/components/links/externalLink';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconFocus, IconLink, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {MarkedText} from 'sentry/utils/marked/markedText';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import PerformanceScoreRingWithTooltips from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import {useProjectRawWebVitalsValuesTimeseriesQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsValuesTimeseriesQuery';
import {usePageSummary} from 'sentry/views/insights/browser/webVitals/queries/usePageSummary';
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
  const organization = useOrganization();
  const theme = useTheme();
  const pageFilters = usePageFilters();
  const {period, start, end, utc} = pageFilters.selection.datetime;

  const {data, isLoading: isLoading} = useProjectRawWebVitalsValuesTimeseriesQuery({
    transaction,
    browserTypes,
    subregions,
  });

  const shouldDoublePeriod = false;

  const {countDiff, currentSeries, currentCount, initialCount} = processSeriesData(
    data['count()'].data,
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
    data['count_scores(measurements.score.inp)'].data,
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

  const ringSegmentColors = theme.chart.getColorPalette(4);
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  // SEER STUFF

  const {data: pageSummary, isLoading: isLoadingPageSummary} = usePageSummary([
    '30c3c594f9ba48748639f2929f05dcee',
    '800da38cb12349d09d8581f8b1ac2113',
    // '7d9863fad38e4c6699425529d1314d15',
  ]);

  const insightCards = [
    {
      id: 'suggestions',
      title: t('Suggestions'),
      insight: pageSummary?.suggestedInvestigations,
      icon: <IconFocus size="sm" />,
    },
  ];

  console.log(insightCards);

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
      <SectionHeading>{t('Seer Suggestions')}</SectionHeading>
      <Content>
        <InsightGrid>
          {isLoadingPageSummary && <Placeholder height="1.5rem" />}
          {insightCards.map(card => {
            if (!card.insight) {
              return null;
            }
            if (!card.insight || typeof card.insight !== 'object') {
              return null;
            }
            return card.insight.map(insight => (
              <InsightCard key={card.id}>
                <CardTitle>
                  <CardTitleIcon>
                    <StyledIconSeer size="md" />
                  </CardTitleIcon>
                  <div>
                    <SpanOp>{insight.spanOp}</SpanOp>
                    <Summary>
                      {' - '}
                      {insight.explanation}
                    </Summary>
                  </div>
                </CardTitle>
                <CardContentContainer>
                  <CardLineDecorationWrapper>
                    <CardLineDecoration />
                  </CardLineDecorationWrapper>
                  <CardContent>
                    <SuggestionsList>
                      {insight.suggestions.map((suggestion, i) => (
                        <li key={i}>{suggestion}</li>
                      ))}
                    </SuggestionsList>
                    <SuggestionLinks>
                      <Link
                        to={`/organizations/${organization.slug}/insights/frontend/trace/${insight.traceId}/?node=span-${insight.spanId}`}
                      >
                        {t('Example')}
                      </Link>
                      {insight.referenceUrl && (
                        <ExternalLink href={insight.referenceUrl}>
                          {t('Reference')}
                        </ExternalLink>
                      )}
                    </SuggestionLinks>
                  </CardContent>
                </CardContentContainer>
              </InsightCard>
            ));
          })}
        </InsightGrid>
      </Content>
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
            yAxis={{
              axisLabel: {formatter: (number: any) => formatAbbreviatedNumber(number)},
            }}
            tooltip={{valueFormatter: number => formatAbbreviatedNumber(number)}}
          />
        )}
      </ChartZoom>
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
              axisLabel: {formatter: (number: any) => formatAbbreviatedNumber(number)},
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
  let seriesData = isLoading
    ? []
    : count.map(({name, value}) => ({
        name,
        value,
      }));

  // Trim off last data point since it's incomplete
  if (seriesData.length > 0 && period && !start && !end) {
    seriesData = seriesData.slice(0, -1);
  }
  const dataMiddleIndex = Math.floor(seriesData.length / 2);
  const currentSeries = shouldDoublePeriod
    ? seriesData.slice(dataMiddleIndex)
    : seriesData;
  const previousSeries = seriesData.slice(0, dataMiddleIndex);

  const initialCount = isLoading
    ? undefined
    : previousSeries.reduce((acc, {value}) => acc + value, 0);
  const currentCount = isLoading
    ? undefined
    : currentSeries.reduce((acc, {value}) => acc + value, 0);
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
  font-size: ${p => p.theme.fontSize.xl};
`;

const ChartSubText = styled('div')<{color?: string}>`
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.color ?? p.theme.subText};
`;

const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  margin: 0;
`;

const ProjectScoreEmptyLoadingElement = styled('div')`
  width: 220px;
  height: 160px;
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  position: relative;
  margin: ${space(1)} 0;
`;

const InsightGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const InsightCard = styled('div')`
  display: flex;
  flex-direction: column;
  border-radius: ${p => p.theme.borderRadius};
  width: 100%;
  min-height: 0;
`;

const CardTitle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding-bottom: ${space(0.5)};
`;

const SpanOp = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  display: inline;
`;
const Summary = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  display: inline;
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const CardContentContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CardLineDecorationWrapper = styled('div')`
  display: flex;
  width: 14px;
  align-self: stretch;
  justify-content: center;
  flex-shrink: 0;
  padding: 0.275rem 0;
`;

const CardLineDecoration = styled('div')`
  width: 1px;
  align-self: stretch;
  background-color: ${p => p.theme.border};
`;

const CardContent = styled('div')`
  overflow-wrap: break-word;
  word-break: break-word;
  p {
    margin: 0;
    white-space: pre-wrap;
  }
  code {
    word-break: break-all;
  }
  flex: 1;
`;

const SuggestionsList = styled('ul')`
  margin: ${space(0.5)} 0;
`;

const SuggestionLinks = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};

  > *:not(:last-child) {
    border-right: 1px solid ${p => p.theme.border};
    padding-right: ${space(1)};
  }
`;

const StyledIconSeer = styled(IconSeer)`
  color: ${p => p.theme.blue400};
`;
