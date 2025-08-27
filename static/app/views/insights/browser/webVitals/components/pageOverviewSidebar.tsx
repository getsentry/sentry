import {Fragment, useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ChartZoom from 'sentry/components/charts/chartZoom';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {
  makeAutofixQueryKey,
  type AutofixResponse,
} from 'sentry/components/events/autofix/useAutofix';
import {
  getRootCauseCopyText,
  getRootCauseDescription,
  getSolutionCopyText,
  getSolutionDescription,
  getSolutionIsLoading,
} from 'sentry/components/events/autofix/utils';
import {AutofixSummary} from 'sentry/components/group/groupSummaryWithAutofix';
import Placeholder from 'sentry/components/placeholder';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {SeriesDataUnit} from 'sentry/types/echarts';
import {IssueType, type Group} from 'sentry/types/group';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import PerformanceScoreRingWithTooltips from 'sentry/views/insights/browser/webVitals/components/performanceScoreRingWithTooltips';
import {useProjectRawWebVitalsValuesTimeseriesQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsValuesTimeseriesQuery';
import {useWebVitalsIssuesQuery} from 'sentry/views/insights/browser/webVitals/queries/useWebVitalsIssuesQuery';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';
import type {ProjectScore} from 'sentry/views/insights/browser/webVitals/types';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useHasSeerWebVitalsSuggestions} from 'sentry/views/insights/browser/webVitals/utils/useHasSeerWebVitalsSuggestions';
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
  const hasSeerWebVitalsSuggestions = useHasSeerWebVitalsSuggestions();
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

  const {data: issues, isLoading: isLoadingIssues} = useWebVitalsIssuesQuery({
    issueTypes: [IssueType.WEB_VITALS],
    transaction,
    enabled: hasSeerWebVitalsSuggestions,
  });

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
      {hasSeerWebVitalsSuggestions && !isLoadingIssues && issues && issues.length > 0 && (
        <Fragment>
          <SectionHeading>{t('Seer Suggestions')}</SectionHeading>
          <Content>
            <InsightGrid>
              {isLoadingIssues && <Placeholder height="1.5rem" />}
              {issues
                ? issues.map(issue => (
                    <IssueAutofixSuggestions key={issue.shortId} issue={issue} />
                  ))
                : null}
            </InsightGrid>
          </Content>
        </Fragment>
      )}
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

function IssueAutofixSuggestions({issue}: {issue: Group}) {
  const organization = useOrganization();
  const {data, isLoading: isLoadingAutofix} = useApiQuery<AutofixResponse>(
    makeAutofixQueryKey(organization.slug, issue.id),
    {
      staleTime: Infinity,
    }
  );

  const autofixData = data?.autofix;

  const rootCauseDescription = useMemo(
    () => (autofixData ? getRootCauseDescription(autofixData) : null),
    [autofixData]
  );

  const rootCauseCopyText = useMemo(
    () => (autofixData ? getRootCauseCopyText(autofixData) : null),
    [autofixData]
  );

  const solutionDescription = useMemo(
    () => (autofixData ? getSolutionDescription(autofixData) : null),
    [autofixData]
  );

  const solutionCopyText = useMemo(
    () => (autofixData ? getSolutionCopyText(autofixData) : null),
    [autofixData]
  );

  const solutionIsLoading = useMemo(
    () => (autofixData ? getSolutionIsLoading(autofixData) : false),
    [autofixData]
  );

  if (isLoadingAutofix) {
    return <Placeholder height="1.5rem" />;
  }

  return (
    <InsightCard key={issue.shortId}>
      <CardTitle>
        <CardTitleIcon>
          <StyledIconSeer size="md" />
        </CardTitleIcon>
        <SpanOp>{issue.title}</SpanOp>
      </CardTitle>
      <CardContentContainer>
        <CardContent>
          <AutofixSummary
            group={issue}
            rootCauseDescription={rootCauseDescription}
            solutionDescription={solutionDescription}
            codeChangesDescription={null}
            codeChangesIsLoading={false}
            rootCauseCopyText={rootCauseCopyText}
            solutionCopyText={solutionCopyText}
            solutionIsLoading={solutionIsLoading}
          />
          <ViewIssueButtonContainer>
            <LinkButton
              to={`/organizations/${organization.slug}/issues/${issue.id}?seerDrawer=true`}
              size="sm"
            >
              {t('View Suggestion')}
            </LinkButton>
          </ViewIssueButtonContainer>
        </CardContent>
      </CardContentContainer>
    </InsightCard>
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
  margin-bottom: ${p => p.theme.space.md};
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
  gap: ${p => p.theme.space.md};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  margin: 0;
`;

const ProjectScoreEmptyLoadingElement = styled('div')`
  width: 220px;
  height: 160px;
`;

const Content = styled(Flex)`
  gap: ${p => p.theme.space.xs};
  position: relative;
  margin: ${p => p.theme.space.md} 0;
`;

const InsightGrid = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
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
  gap: ${p => p.theme.space.xs};
  padding-bottom: ${p => p.theme.space.xs};
`;

const SpanOp = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  display: block;
`;

const CardTitleIcon = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
`;

const CardContentContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
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

const StyledIconSeer = styled(IconSeer)`
  color: ${p => p.theme.blue400};
`;

const ViewIssueButtonContainer = styled('div')`
  margin: ${p => p.theme.space.lg} 0;
`;
