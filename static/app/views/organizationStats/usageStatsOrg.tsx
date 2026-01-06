import type {MouseEvent as ReactMouseEvent} from 'react';
import React, {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {navigateTo} from 'sentry/actionCreators/navigation';
import type {TooltipSubLabel} from 'sentry/components/charts/components/tooltip';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {InlineContainer, SectionHeading} from 'sentry/components/charts/styles';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Switch} from 'sentry/components/core/switch';
import NotAvailable from 'sentry/components/notAvailable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {ScoreCard} from 'sentry/components/scoreCard';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  DataCategory,
  DataCategoryExact,
  DataCategoryInfo,
  IntervalPeriod,
} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {shouldUse24Hours} from 'sentry/utils/dates';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useRouter from 'sentry/utils/useRouter';

import {
  FORMAT_DATETIME_DAILY,
  FORMAT_DATETIME_HOURLY,
  FORMAT_DATETIME_HOURLY_24H,
  getTooltipFormatter,
} from './usageChart/utils';
import {mapSeriesToChart} from './mapSeriesToChart';
import type {UsageSeries} from './types';
import type {ChartStats, UsageChartProps} from './usageChart';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  ChartDataTransform,
  SeriesTypes,
} from './usageChart';
import UsageStatsPerMin from './usageStatsPerMin';
import {isDisplayUtc} from './utils';

type ChartData = {
  cardStats: {
    accepted?: string;
    accepted_stored?: string;
    clientDiscard?: string;
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
};

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

export function getEndpointQuery({
  dataDatetime,
  organization,
  projectIds,
  dataCategoryApiName,
  endpointQueryDatetime,
}: {
  dataCategoryApiName: string;
  dataDatetime: DateTimeObject;
  endpointQueryDatetime: DateTimeObject;
  organization: Organization;
  projectIds: number[];
}) {
  const queryDatetime = endpointQueryDatetime;

  const groupBy = ['outcome', 'reason'];
  const category: string[] = [dataCategoryApiName];

  if (hasDynamicSamplingCustomFeature(organization) && dataCategoryApiName === 'span') {
    groupBy.push('category');
    category.push('span_indexed');
  }

  return {
    ...queryDatetime,
    interval: getSeriesApiInterval(dataDatetime),
    groupBy,
    project: projectIds,
    field: ['sum(quantity)'],
    category,
  };
}

export function getChartProps({
  dataError,
  chartData,
  dataCategory,
  clientDiscard,
  handleChangeState,
  error,
  loading,
  handleOnDocsClick,
}: {
  chartData: Pick<
    ChartData,
    | 'chartDateEnd'
    | 'chartDateInterval'
    | 'chartDateStart'
    | 'chartDateUtc'
    | 'chartStats'
    | 'chartSubLabels'
    | 'chartTransform'
    | 'chartDateStartDisplay'
    | 'chartDateTimezoneDisplay'
    | 'chartDateEndDisplay'
    | 'chartStats'
    | 'cardStats'
  >;
  dataCategory: DataCategory;
  error: RequestError | null;
  handleChangeState: (state: {
    clientDiscard?: boolean;
    dataCategory?: DataCategory;
    pagePeriod?: string | null;
    transform?: ChartDataTransform;
  }) => void;
  handleOnDocsClick: (
    source:
      | 'card-accepted'
      | 'card-filtered'
      | 'card-rate-limited'
      | 'card-invalid'
      | 'chart-title'
  ) => void;
  loading: boolean;
  clientDiscard?: boolean;
  dataError?: Error;
}): UsageChartProps & {
  footer: React.ReactNode;
  title: React.ReactNode;
} {
  const errors: Record<string, Error> | undefined =
    error || dataError
      ? {
          ...(error ? {error} : {}),
          ...(dataError ? {data: dataError} : {}),
        }
      : undefined;

  return {
    isLoading: loading,
    isError: Boolean(error || !!dataError),
    errors,
    title: (
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
    ),
    footer: (
      <Footer>
        <InlineContainer>
          <FooterDate>
            <SectionHeading>{t('Date Range:')}</SectionHeading>
            <span>
              {loading || error ? (
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
            <Flex align="center" gap="md">
              <strong>
                {chartData.cardStats.clientDiscard
                  ? tct('Show client-discarded data ([count]):', {
                      count: chartData.cardStats.clientDiscard,
                    })
                  : t('Show client-discarded data:')}
              </strong>
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
    ),
    dataCategory,
    dataTransform: chartData.chartTransform,
    usageDateStart: chartData.chartDateStart,
    usageDateEnd: chartData.chartDateEnd,
    usageDateShowUtc: chartData.chartDateUtc,
    usageDateInterval: chartData.chartDateInterval,
    usageStats: chartData.chartStats,
    chartTooltip: {
      subLabels: chartData.chartSubLabels,
      skipZeroValuedSubLabels: true,
      trigger: 'axis',
      valueFormatter: getTooltipFormatter(dataCategory),
    },
    legendSelected: {[SeriesTypes.CLIENT_DISCARD]: !!clientDiscard},
    onLegendSelectChanged: ({name, selected}) => {
      if (name === SeriesTypes.CLIENT_DISCARD) {
        handleChangeState({clientDiscard: selected[name]});
      }
    },
  };
}

function ScoreCards({
  cardMetadata,
  loading,
}: {
  cardMetadata: CardMetadata;
  loading: boolean;
}) {
  return Object.values(cardMetadata).map((card, i) => (
    <StyledScoreCard
      key={i}
      title={card.title}
      score={loading ? undefined : card.score}
      help={card.help}
      trend={card.trend}
      isTooltipHoverable
    />
  ));
}

function ChartContainer({children}: {children: React.ReactNode}) {
  return <ChartWrapper data-test-id="usage-stats-chart">{children}</ChartWrapper>;
}

export interface UsageStatsOrganizationProps {
  dataCategory: DataCategory;
  dataCategoryApiName: DataCategoryExact;
  dataCategoryName: DataCategoryInfo['titleName'];
  dataDatetime: DateTimeObject;
  handleChangeState: (state: {
    clientDiscard?: boolean;
    dataCategory?: DataCategory;
    pagePeriod?: string | null;
    transform?: ChartDataTransform;
  }) => void;
  organization: Organization;
  projectIds: number[];
  chartTransform?: string;
  children?: (props: {
    cardMetadata: CardMetadata;
    chartData: ChartData;
    handleOnDocsClick: (
      source:
        | 'card-accepted'
        | 'card-filtered'
        | 'card-rate-limited'
        | 'card-invalid'
        | 'chart-title'
    ) => void;
    orgStats: UseApiQueryResult<UsageSeries | undefined, RequestError>;
    usageChart: React.ReactNode;
  }) => React.ReactNode | React.ReactNode;
  clientDiscard?: boolean;
  clock24Hours?: boolean;
  endpointQuery?: ReturnType<typeof getEndpointQuery>;
  projectDetails?: React.ReactNode[];
}

type CardMetadata = Record<
  'total' | 'accepted' | 'filtered' | 'rateLimited' | 'invalid',
  {
    title: React.ReactNode;
    help?: React.ReactNode;
    score?: string;
    trend?: React.ReactNode;
  }
>;

function UsageStatsOrganization({
  dataDatetime,
  projectIds,
  dataCategoryApiName,
  organization,
  dataCategory,
  dataCategoryName,
  clientDiscard,
  handleChangeState,
  chartTransform,
  children,
  endpointQuery,
}: UsageStatsOrganizationProps) {
  const router = useRouter();
  const orgStatsQuery = useMemo(() => {
    return (
      endpointQuery ??
      getEndpointQuery({
        dataCategoryApiName,
        dataDatetime,
        organization,
        projectIds,
        endpointQueryDatetime: getEndpointQueryDatetime(dataDatetime),
      })
    );
  }, [endpointQuery, dataCategoryApiName, dataDatetime, organization, projectIds]);

  const orgStatsReponse = useApiQuery<UsageSeries | undefined>(
    [
      `/organizations/${organization.slug}/stats_v2/`,
      {
        query: orgStatsQuery,
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
    }
  );

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
    if (!orgStatsReponse.data?.intervals) {
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

    const {intervals} = orgStatsReponse.data;
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
  }, [orgStatsReponse.data, dataDatetime]);

  const chartData: {
    cardStats: {
      accepted?: string;
      accepted_stored?: string;
      clientDiscard?: string;
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
        orgStats: orgStatsReponse.data,
        chartDateInterval: chartDateRange.chartDateInterval,
        chartDateUtc: chartDateRange.chartDateUtc,
        dataCategory,
        endpointQuery: orgStatsQuery,
      }),
      ...chartDateRange,
      ...chartDataTransform,
    };
  }, [
    orgStatsReponse.data,
    orgStatsQuery,
    chartDateRange,
    dataCategory,
    chartDataTransform,
  ]);

  const cardMetadata: CardMetadata = useMemo(() => {
    const {total, accepted, accepted_stored, invalid, rateLimited, filtered} =
      chartData.cardStats;

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

  const chartProps = useMemo(() => {
    return getChartProps({
      chartData,
      clientDiscard,
      dataCategory,
      error: orgStatsReponse.error,
      loading: orgStatsReponse.isPending,
      handleChangeState,
      handleOnDocsClick,
    });
  }, [
    handleOnDocsClick,
    chartData,
    clientDiscard,
    dataCategory,
    orgStatsReponse.error,
    orgStatsReponse.isPending,
    handleChangeState,
  ]);

  return typeof children === 'function' ? (
    children({
      usageChart: <UsageChart {...chartProps} />,
      cardMetadata,
      orgStats: orgStatsReponse,
      handleOnDocsClick,
      chartData,
    })
  ) : (
    <PageGrid>
      <ScoreCards cardMetadata={cardMetadata} loading={orgStatsReponse.isPending} />
      <ChartContainer>
        <UsageChart {...chartProps} />
      </ChartContainer>
    </PageGrid>
  );
}

export default UsageStatsOrganization;

const PageGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (min-width: ${p => p.theme.breakpoints.lg}) {
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
    font-weight: ${p => p.theme.fontWeight.normal};
    font-size: ${p => p.theme.fontSize.md};
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
            icon={<IconSettings variant="muted" />}
            title={t('Dynamic Sampling Settings')}
            aria-label={t('Dynamic Sampling Settings')}
            to={`/settings/${organization.slug}/dynamic-sampling/`}
          />
        )}
    </StyledTextWrapper>
  );
}

export const UsageStatsOrgComponents = {
  PageGrid,
  ChartContainer,
  ScoreCards,
};
