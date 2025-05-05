import type {MouseEvent as ReactMouseEvent} from 'react';
import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {navigateTo} from 'sentry/actionCreators/navigation';
import type {TooltipSubLabel} from 'sentry/components/charts/components/tooltip';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {InlineContainer, SectionHeading} from 'sentry/components/charts/styles';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import {Flex} from 'sentry/components/container/flex';
import {LinkButton} from 'sentry/components/core/button';
import {Switch} from 'sentry/components/core/switch';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import NotAvailable from 'sentry/components/notAvailable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import ScoreCard from 'sentry/components/scoreCard';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory, DataCategoryInfo, IntervalPeriod} from 'sentry/types/core';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {
  FORMAT_DATETIME_DAILY,
  FORMAT_DATETIME_HOURLY,
  FORMAT_DATETIME_HOURLY_24H,
  getTooltipFormatter,
} from './usageChart/utils';
import {mapSeriesToChart} from './mapSeriesToChart';
import type {UsageSeries} from './types';
import type {ChartStats} from './usageChart';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  ChartDataTransform,
  SeriesTypes,
} from './usageChart';
import UsageStatsPerMin from './usageStatsPerMin';
import {isContinuousProfiling, isDisplayUtc} from './utils';

export function getEndpointQueryDatetime(dataDatetime: DateTimeObject) {
  return dataDatetime.start && dataDatetime.end
    ? {
        start: dataDatetime.start,
        end: dataDatetime.end,
        utc: dataDatetime.utc,
      }
    : {
        statsPeriod: dataDatetime.period || DEFAULT_STATS_PERIOD,
      };
}

export function useStatsOrgData({
  dataDatetime,
  dataCategoryApiName,
  projectIds,
}: {
  dataCategoryApiName: string;
  dataDatetime: DateTimeObject;
  projectIds: number[];
}) {
  const organization = useOrganization();
  const endpointQueryDatetime = getEndpointQueryDatetime(dataDatetime);

  const endpointQuery = useMemo(() => {
    const queryDatetime = endpointQueryDatetime;

    const groupBy = ['outcome', 'reason'];
    const category: string[] = [dataCategoryApiName];

    if (hasDynamicSamplingCustomFeature(organization) && dataCategoryApiName === 'span') {
      groupBy.push('category');
      category.push('span_indexed');
    }
    if (['profile_duration', 'profile_duration_ui'].includes(dataCategoryApiName)) {
      groupBy.push('category');
      category.push(
        dataCategoryApiName === 'profile_duration' ? 'profile_chunk' : 'profile_chunk_ui'
      );
    }

    return {
      ...queryDatetime,
      interval: getSeriesApiInterval(dataDatetime),
      groupBy,
      project: projectIds,
      field: ['sum(quantity)'],
      category,
    };
  }, [
    endpointQueryDatetime,
    dataCategoryApiName,
    dataDatetime,
    projectIds,
    organization,
  ]);

  const response = useApiQuery<UsageSeries | undefined>(
    [
      `/organizations/${organization.slug}/stats_v2/`,
      {
        query: endpointQuery,
      },
    ],
    {
      staleTime: 0,
    }
  );

  return {
    ...response,
    endpointQuery,
  };
}

export interface UsageStatsOrganizationProps extends WithRouterProps {
  dataCategory: DataCategory;
  dataCategoryApiName: DataCategoryInfo['apiName'];
  dataCategoryName: string;
  dataDatetime: DateTimeObject;
  handleChangeState: (state: {
    clientDiscard?: boolean;
    dataCategory?: DataCategory;
    pagePeriod?: string | null;
    transform?: ChartDataTransform;
  }) => void;
  isSingleProject: boolean;
  organization: Organization;
  projectIds: number[];
  chartTransform?: string;
  clientDiscard?: boolean;
  clock24Hours?: boolean;
  projectDetails?: React.ReactNode[];
}

type CardMetadata = Record<
  'total' | 'accepted' | 'filtered' | 'rateLimited' | 'invalid',
  {
    title: React.ReactNode;
    help?: React.ReactNode;
    isEstimate?: boolean;
    score?: string;
    trend?: React.ReactNode;
  }
>;

function UsageStatsOrganization({
  dataDatetime,
  projectIds,
  dataCategoryApiName,
  organization,
  isSingleProject,
  dataCategory,
  dataCategoryName,
  router,
  clientDiscard,
  handleChangeState,
  projectDetails = [],
  chartTransform,
}: UsageStatsOrganizationProps) {
  const {
    endpointQuery,
    data: orgStats,
    isPending,
    error,
    isError,
  } = useStatsOrgData({dataCategoryApiName, dataDatetime, projectIds});

  const handleOnDocsClick = useCallback(
    (
      source:
        | 'card-accepted'
        | 'card-filtered'
        | 'card-rate-limited'
        | 'card-invalid'
        | 'chart-title'
    ) => {
      trackAnalytics('stats.docs_clicked', {
        organization,
        source,
        dataCategory,
      });
    },
    [organization, dataCategory]
  );

  const navigateToInboundFilterSettings = useCallback(
    (event: ReactMouseEvent) => {
      event.preventDefault();
      const url = `/settings/${organization.slug}/projects/:projectId/filters/data-filters/`;
      if (router) {
        navigateTo(url, router);
      }
    },
    [router, organization]
  );

  const chartDataTransform: {chartTransform: ChartDataTransform} = useMemo(() => {
    switch (chartTransform) {
      case ChartDataTransform.CUMULATIVE:
      case ChartDataTransform.PERIODIC:
        return {chartTransform};
      default:
        return {chartTransform: ChartDataTransform.PERIODIC};
    }
  }, [chartTransform]);

  const chartDateRange = useMemo(() => {
    const interval = getSeriesApiInterval(dataDatetime);

    // Use fillers as loading/error states will not display datetime at all
    if (!orgStats?.intervals) {
      return {
        chartDateInterval: interval,
        chartDateStart: '',
        chartDateEnd: '',
        chartDateUtc: true,
        chartDateStartDisplay: '',
        chartDateEndDisplay: '',
        chartDateTimezoneDisplay: '',
      };
    }

    const {intervals} = orgStats;
    const intervalHours = parsePeriodToHours(interval);

    // Keep datetime in UTC until we want to display it to users
    const startTime = moment(intervals[0]).utc();
    const endTime =
      intervals.length < 2
        ? moment(startTime) // when statsPeriod and interval is the same value
        : moment(intervals[intervals.length - 1]).utc();
    const useUtc = isDisplayUtc(dataDatetime);

    // If interval is a day or more, use UTC to format date. Otherwise, the date
    // may shift ahead/behind when converting to the user's local time.
    let FORMAT_DATETIME: string;
    if (intervalHours >= 24) {
      // Daily format doesn't have time, so no change needed
      FORMAT_DATETIME = FORMAT_DATETIME_DAILY;
    } else if (shouldUse24Hours()) {
      FORMAT_DATETIME = FORMAT_DATETIME_HOURLY_24H;
    } else {
      FORMAT_DATETIME = FORMAT_DATETIME_HOURLY;
    }

    const xAxisStart = moment(startTime);
    const xAxisEnd = moment(endTime);
    const displayStart = useUtc ? moment(startTime).utc() : moment(startTime).local();
    const displayEnd = useUtc ? moment(endTime).utc() : moment(endTime).local();

    if (intervalHours < 24) {
      displayEnd.add(intervalHours, 'h');
    }

    return {
      chartDateInterval: interval,
      chartDateStart: xAxisStart.format(),
      chartDateEnd: xAxisEnd.format(),
      chartDateUtc: useUtc,
      chartDateStartDisplay: displayStart.format(FORMAT_DATETIME),
      chartDateEndDisplay: displayEnd.format(FORMAT_DATETIME),
      chartDateTimezoneDisplay: displayStart.format('Z'),
    };
  }, [orgStats, dataDatetime]);

  const chartData: {
    cardStats: {
      accepted?: string;
      accepted_stored?: string;
      filtered?: string;
      invalid?: string;
      rateLimited?: string;
      total?: string;
    };
    chartDateEnd: string;
    chartDateEndDisplay: string;
    chartDateInterval: IntervalPeriod;
    chartDateStart: string;
    chartDateStartDisplay: string;
    chartDateTimezoneDisplay: string;
    chartDateUtc: boolean;
    chartStats: ChartStats;
    chartSubLabels: TooltipSubLabel[];
    chartTransform: ChartDataTransform;
    dataError?: Error;
  } = useMemo(() => {
    return {
      ...mapSeriesToChart({
        orgStats,
        chartDateInterval: chartDateRange.chartDateInterval,
        chartDateUtc: chartDateRange.chartDateUtc,
        dataCategory,
        endpointQuery,
      }),
      ...chartDateRange,
      ...chartDataTransform,
    };
  }, [orgStats, endpointQuery, chartDateRange, dataCategory, chartDataTransform]);

  const cardMetadata: CardMetadata = useMemo(() => {
    const {total, accepted, accepted_stored, invalid, rateLimited, filtered} =
      chartData.cardStats;
    const shouldShowEstimate = isContinuousProfiling(dataCategory);

    return {
      total: {
        title: tct('Total [dataCategory]', {dataCategory: dataCategoryName}),
        score: total,
      },
      accepted: {
        title: tct('Accepted [dataCategory]', {dataCategory: dataCategoryName}),
        help: tct(
          'Accepted [dataCategory] were successfully processed by Sentry. For more information, read our [docsLink:docs].',
          {
            dataCategory: dataCategoryName,
            docsLink: (
              <ExternalLink
                href="https://docs.sentry.io/product/stats/#accepted"
                onClick={() => handleOnDocsClick('card-accepted')}
              />
            ),
          }
        ),
        score: accepted,
        trend:
          dataCategoryApiName === 'span' && accepted_stored ? (
            <SpansStored organization={organization} acceptedStored={accepted_stored} />
          ) : (
            <UsageStatsPerMin
              dataCategoryApiName={dataCategoryApiName}
              dataCategory={dataCategory}
              organization={organization}
              projectIds={projectIds}
            />
          ),
      },
      filtered: {
        title: tct('Filtered [dataCategory]', {dataCategory: dataCategoryName}),
        help: tct(
          'Filtered [dataCategory] were blocked due to your [filterSettings: inbound data filter] rules. For more information, read our [docsLink:docs].',
          {
            dataCategory: dataCategoryName,
            filterSettings: (
              <a href="#" onClick={event => navigateToInboundFilterSettings(event)} />
            ),
            docsLink: (
              <ExternalLink
                href="https://docs.sentry.io/product/stats/#filtered"
                onClick={() => handleOnDocsClick('card-filtered')}
              />
            ),
          }
        ),
        score: filtered,
        isEstimate: shouldShowEstimate,
      },
      rateLimited: {
        title: tct('Rate Limited [dataCategory]', {dataCategory: dataCategoryName}),
        help: tct(
          'Rate Limited [dataCategory] were discarded due to rate limits or quota. For more information, read our [docsLink:docs].',
          {
            dataCategory: dataCategoryName,
            docsLink: (
              <ExternalLink
                href="https://docs.sentry.io/product/stats/#rate-limited"
                onClick={() => handleOnDocsClick('card-rate-limited')}
              />
            ),
          }
        ),
        score: rateLimited,
        isEstimate: shouldShowEstimate,
      },
      invalid: {
        title: tct('Invalid [dataCategory]', {dataCategory: dataCategoryName}),
        help: tct(
          'Invalid [dataCategory] were sent by the SDK and were discarded because the data did not meet the basic schema requirements. For more information, read our [docsLink:docs].',
          {
            dataCategory: dataCategoryName,
            docsLink: (
              <ExternalLink
                href="https://docs.sentry.io/product/stats/#invalid"
                onClick={() => handleOnDocsClick('card-invalid')}
              />
            ),
          }
        ),
        score: invalid,
        isEstimate: shouldShowEstimate,
      },
    };
  }, [
    handleOnDocsClick,
    dataCategory,
    dataCategoryName,
    dataCategoryApiName,
    organization,
    projectIds,
    chartData,
    navigateToInboundFilterSettings,
  ]);

  const chartErrors = useMemo(() => {
    if (!isError) return undefined;
    return {
      ...error,
      ...(chartData.dataError ? {data: chartData.dataError} : {}),
    } as any; // TODO: fix type;
  }, [isError, error, chartData.dataError]);

  return (
    <Fragment>
      <PageGrid>
        {Object.values(cardMetadata).map((card, i) => (
          <StyledScoreCard
            key={i}
            title={card.title}
            score={isPending ? undefined : card.score}
            help={card.help}
            trend={card.trend}
            isEstimate={card.isEstimate}
            isTooltipHoverable
          />
        ))}
        <ChartWrapper data-test-id="usage-stats-chart">
          <UsageChart
            isLoading={isPending}
            isError={isError}
            errors={chartErrors}
            title={
              <Fragment>
                {t('Project(s) Stats')}
                <QuestionTooltip
                  size="xs"
                  title={tct(
                    'You can find more information about each category in our [link:docs]',
                    {
                      link: (
                        <ExternalLink
                          href="https://docs.sentry.io/product/stats/#usage-stats"
                          onClick={() => handleOnDocsClick('chart-title')}
                        />
                      ),
                    }
                  )}
                  isHoverable
                />
              </Fragment>
            }
            footer={
              <Footer>
                <InlineContainer>
                  <FooterDate>
                    <SectionHeading>{t('Date Range:')}</SectionHeading>
                    <span>
                      {isPending || isError ? (
                        <NotAvailable />
                      ) : (
                        tct('[start] — [end] ([timezone] UTC, [interval] interval)', {
                          start: chartData.chartDateStartDisplay,
                          end: chartData.chartDateEndDisplay,
                          timezone: chartData.chartDateTimezoneDisplay,
                          interval: chartData.chartDateInterval,
                        })
                      )}
                    </span>
                  </FooterDate>
                </InlineContainer>
                <InlineContainer>
                  {(chartData.chartStats.clientDiscard ?? []).length > 0 && (
                    <Flex align="center" gap={space(1)}>
                      <strong>{t('Show client-discarded data:')}</strong>
                      <Switch
                        onChange={() => {
                          handleChangeState({clientDiscard: !clientDiscard});
                        }}
                        checked={clientDiscard}
                      />
                    </Flex>
                  )}
                </InlineContainer>
                <InlineContainer>
                  <OptionSelector
                    title={t('Type')}
                    selected={chartData.chartTransform}
                    options={CHART_OPTIONS_DATA_TRANSFORM}
                    onChange={(val: string) =>
                      handleChangeState({transform: val as ChartDataTransform})
                    }
                  />
                </InlineContainer>
              </Footer>
            }
            dataCategory={dataCategory}
            dataTransform={chartData.chartTransform}
            usageDateStart={chartData.chartDateStart}
            usageDateEnd={chartData.chartDateEnd}
            usageDateShowUtc={chartData.chartDateUtc}
            usageDateInterval={chartData.chartDateInterval}
            usageStats={chartData.chartStats}
            chartTooltip={{
              subLabels: chartData.chartSubLabels,
              skipZeroValuedSubLabels: true,
              trigger: 'axis',
              valueFormatter: getTooltipFormatter(dataCategory),
            }}
            legendSelected={{[SeriesTypes.CLIENT_DISCARD]: !!clientDiscard}}
            onLegendSelectChanged={({name, selected}) => {
              if (name === SeriesTypes.CLIENT_DISCARD) {
                handleChangeState({clientDiscard: selected[name]});
              }
            }}
          />
        </ChartWrapper>
      </PageGrid>
      {isSingleProject
        ? projectDetails.map((projectDetailComponent, i) => (
            <ErrorBoundary mini key={i}>
              {projectDetailComponent}
            </ErrorBoundary>
          ))
        : null}
    </Fragment>
  );
}

export default UsageStatsOrganization;

const PageGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: repeat(5, 1fr);
  }
`;

const StyledScoreCard = styled(ScoreCard)`
  grid-column: auto / span 1;
  margin: 0;
`;

const ChartWrapper = styled('div')`
  grid-column: 1 / -1;
`;

const Footer = styled('div')`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space(1.5)};
  padding: ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.border};
  > *:first-child {
    flex-grow: 1;
  }
`;

const FooterDate = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;

  > ${SectionHeading} {
    margin-right: ${space(1.5)};
  }

  > span:last-child {
    font-weight: ${p => p.theme.fontWeightNormal};
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;

type SpansStoredProps = {
  acceptedStored: string;
  organization: Organization;
};

const StyledSettingsButton = styled(LinkButton)`
  top: 2px;
`;

const StyledTextWrapper = styled('div')`
  min-height: 22px;
`;

function SpansStored({organization, acceptedStored}: SpansStoredProps) {
  return (
    <StyledTextWrapper>
      {t('%s stored', acceptedStored)}{' '}
      {organization.access.includes('org:read') &&
        hasDynamicSamplingCustomFeature(organization) && (
          <StyledSettingsButton
            borderless
            size="zero"
            icon={<IconSettings color="subText" />}
            title={t('Dynamic Sampling Settings')}
            aria-label={t('Dynamic Sampling Settings')}
            to={`/settings/${organization.slug}/dynamic-sampling/`}
          />
        )}
    </StyledTextWrapper>
  );
}
