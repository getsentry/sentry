import {Fragment, MouseEvent as ReactMouseEvent} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import isEqual from 'lodash/isEqual';
import moment from 'moment';

import {navigateTo} from 'sentry/actionCreators/navigation';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {InlineContainer, SectionHeading} from 'sentry/components/charts/styles';
import {DateTimeObject, getSeriesApiInterval} from 'sentry/components/charts/utils';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import ErrorBoundary from 'sentry/components/errorBoundary';
import NotAvailable from 'sentry/components/notAvailable';
import ScoreCard, {ScoreCardProps} from 'sentry/components/scoreCard';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategoryInfo, IntervalPeriod, Organization, Outcome} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';

import {
  FORMAT_DATETIME_DAILY,
  FORMAT_DATETIME_HOURLY,
  getDateFromMoment,
} from './usageChart/utils';
import {UsageSeries, UsageStat} from './types';
import UsageChart, {
  CHART_OPTIONS_DATA_TRANSFORM,
  ChartDataTransform,
  ChartStats,
  UsageChartProps,
} from './usageChart';
import UsageStatsPerMin from './usageStatsPerMin';
import {formatUsageWithUnits, getFormatUsageOptions, isDisplayUtc} from './utils';

export type UsageStatsOrganizationProps = {
  dataCategory: DataCategoryInfo['plural'];
  dataCategoryName: string;
  dataDatetime: DateTimeObject;
  handleChangeState: (state: {
    dataCategory?: DataCategoryInfo['plural'];
    pagePeriod?: string | null;
    transform?: ChartDataTransform;
  }) => void;
  isSingleProject: boolean;
  organization: Organization;
  projectIds: number[];
  chartTransform?: string;
} & DeprecatedAsyncComponent['props'];

type UsageStatsOrganizationState = {
  orgStats: UsageSeries | undefined;
} & DeprecatedAsyncComponent['state'];

/**
 * This component is replaced by EnhancedUsageStatsOrganization in getsentry, which inherits
 * heavily from this one. Take care if changing any existing function signatures to ensure backwards
 * compatibility.
 */
class UsageStatsOrganization<
  P extends UsageStatsOrganizationProps = UsageStatsOrganizationProps,
  S extends UsageStatsOrganizationState = UsageStatsOrganizationState,
> extends DeprecatedAsyncComponent<P, S> {
  componentDidUpdate(prevProps: UsageStatsOrganizationProps) {
    const {dataDatetime: prevDateTime, projectIds: prevProjectIds} = prevProps;
    const {dataDatetime: currDateTime, projectIds: currProjectIds} = this.props;

    if (
      prevDateTime.start !== currDateTime.start ||
      prevDateTime.end !== currDateTime.end ||
      prevDateTime.period !== currDateTime.period ||
      prevDateTime.utc !== currDateTime.utc ||
      !isEqual(prevProjectIds, currProjectIds)
    ) {
      this.reloadData();
    }
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    return [['orgStats', this.endpointPath, {query: this.endpointQuery}]];
  }

  /** List of components to render on single-project view */
  get projectDetails(): JSX.Element[] {
    return [];
  }

  get endpointPath() {
    const {organization} = this.props;
    return `/organizations/${organization.slug}/stats_v2/`;
  }

  get endpointQueryDatetime() {
    const {dataDatetime} = this.props;
    const queryDatetime =
      dataDatetime.start && dataDatetime.end
        ? {
            start: dataDatetime.start,
            end: dataDatetime.end,
            utc: dataDatetime.utc,
          }
        : {
            statsPeriod: dataDatetime.period || DEFAULT_STATS_PERIOD,
          };
    return queryDatetime;
  }

  get endpointQuery() {
    const {dataDatetime, projectIds} = this.props;

    const queryDatetime = this.endpointQueryDatetime;

    return {
      ...queryDatetime,
      interval: getSeriesApiInterval(dataDatetime),
      groupBy: ['category', 'outcome'],
      project: projectIds,
      field: ['sum(quantity)'],
    };
  }

  get chartData(): {
    cardStats: {
      accepted?: string;
      dropped?: string;
      filtered?: string;
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
    chartTransform: ChartDataTransform;
    dataError?: Error;
  } {
    const {orgStats} = this.state;

    return {
      ...this.mapSeriesToChart(orgStats),
      ...this.chartDateRange,
      ...this.chartTransform,
    };
  }

  get chartTransform(): {chartTransform: ChartDataTransform} {
    const {chartTransform} = this.props;

    switch (chartTransform) {
      case ChartDataTransform.CUMULATIVE:
      case ChartDataTransform.PERIODIC:
        return {chartTransform};
      default:
        return {chartTransform: ChartDataTransform.PERIODIC};
    }
  }

  get chartDateRange(): {
    chartDateEnd: string;
    chartDateEndDisplay: string;
    chartDateInterval: IntervalPeriod;
    chartDateStart: string;
    chartDateStartDisplay: string;
    chartDateTimezoneDisplay: string;
    chartDateUtc: boolean;
  } {
    const {orgStats} = this.state;
    const {dataDatetime} = this.props;

    const interval = getSeriesApiInterval(dataDatetime);

    // Use fillers as loading/error states will not display datetime at all
    if (!orgStats || !orgStats.intervals) {
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
    const FORMAT_DATETIME =
      intervalHours >= 24 ? FORMAT_DATETIME_DAILY : FORMAT_DATETIME_HOURLY;

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
  }

  get chartProps(): UsageChartProps {
    const {dataCategory} = this.props;
    const {error, errors, loading} = this.state;
    const {
      chartStats,
      dataError,
      chartDateInterval,
      chartDateStart,
      chartDateEnd,
      chartDateUtc,
      chartTransform,
    } = this.chartData;

    const hasError = error || !!dataError;
    const chartErrors: any = dataError ? {...errors, data: dataError} : errors; // TODO(ts): AsyncComponent
    const chartProps = {
      isLoading: loading,
      isError: hasError,
      errors: chartErrors,
      title: ' ', // Force the title to be blank
      footer: this.renderChartFooter(),
      dataCategory,
      dataTransform: chartTransform,
      usageDateStart: chartDateStart,
      usageDateEnd: chartDateEnd,
      usageDateShowUtc: chartDateUtc,
      usageDateInterval: chartDateInterval,
      usageStats: chartStats,
    } as UsageChartProps;

    return chartProps;
  }

  get cardMetadata() {
    const {dataCategory, dataCategoryName, organization, projectIds, router} = this.props;
    const {total, accepted, dropped, filtered} = this.chartData.cardStats;

    const navigateToInboundFilterSettings = (event: ReactMouseEvent) => {
      event.preventDefault();
      const url = `/settings/${organization.slug}/projects/:projectId/filters/data-filters/`;
      if (router) {
        navigateTo(url, router);
      }
    };

    const cardMetadata: Record<string, ScoreCardProps> = {
      total: {
        title: tct('Total [dataCategory]', {dataCategory: dataCategoryName}),
        score: total,
      },
      accepted: {
        title: tct('Accepted [dataCategory]', {dataCategory: dataCategoryName}),
        help: tct('Accepted [dataCategory] were successfully processed by Sentry', {
          dataCategory,
        }),
        score: accepted,
        trend: (
          <UsageStatsPerMin
            dataCategory={dataCategory}
            organization={organization}
            projectIds={projectIds}
          />
        ),
      },
      filtered: {
        title: tct('Filtered [dataCategory]', {dataCategory: dataCategoryName}),
        help: tct(
          'Filtered [dataCategory] were blocked due to your [filterSettings: inbound data filter] rules',
          {
            dataCategory,
            filterSettings: (
              <a href="#" onClick={event => navigateToInboundFilterSettings(event)} />
            ),
          }
        ),
        score: filtered,
      },
      dropped: {
        title: tct('Dropped [dataCategory]', {dataCategory: dataCategoryName}),
        help: tct(
          'Dropped [dataCategory] were discarded due to invalid data, rate-limits, quota limits, or spike protection',
          {dataCategory}
        ),
        score: dropped,
      },
    };
    return cardMetadata;
  }

  mapSeriesToChart(orgStats?: UsageSeries): {
    cardStats: {
      accepted?: string;
      dropped?: string;
      filtered?: string;
      total?: string;
    };
    chartStats: ChartStats;
    dataError?: Error;
  } {
    const cardStats = {
      total: undefined,
      accepted: undefined,
      dropped: undefined,
      filtered: undefined,
    };
    const chartStats: ChartStats = {
      accepted: [],
      dropped: [],
      projected: [],
      filtered: [],
    };

    if (!orgStats) {
      return {cardStats, chartStats};
    }

    try {
      const {dataCategory} = this.props;
      const {chartDateInterval, chartDateUtc} = this.chartDateRange;

      const usageStats: UsageStat[] = orgStats.intervals.map(interval => {
        const dateTime = moment(interval);

        return {
          date: getDateFromMoment(dateTime, chartDateInterval, chartDateUtc),
          total: 0,
          accepted: 0,
          filtered: 0,
          dropped: {total: 0},
        };
      });

      // Tally totals for card data
      const count: Record<'total' | Outcome, number> = {
        total: 0,
        [Outcome.ACCEPTED]: 0,
        [Outcome.FILTERED]: 0,
        [Outcome.DROPPED]: 0,
        [Outcome.INVALID]: 0, // Combined with dropped later
        [Outcome.RATE_LIMITED]: 0, // Combined with dropped later
        [Outcome.CLIENT_DISCARD]: 0, // Not exposed yet
      };

      orgStats.groups.forEach(group => {
        const {outcome, category} = group.by;
        // HACK: The backend enum are singular, but the frontend enums are plural
        if (!dataCategory.includes(`${category}`)) {
          return;
        }

        if (outcome !== Outcome.CLIENT_DISCARD) {
          count.total += group.totals['sum(quantity)'];
        }

        count[outcome] += group.totals['sum(quantity)'];

        group.series['sum(quantity)'].forEach((stat, i) => {
          switch (outcome) {
            case Outcome.ACCEPTED:
            case Outcome.FILTERED:
              usageStats[i][outcome] += stat;
              return;
            case Outcome.DROPPED:
            case Outcome.RATE_LIMITED:
            case Outcome.INVALID:
              usageStats[i].dropped.total += stat;
              // TODO: add client discards to dropped?
              return;
            default:
              return;
          }
        });
      });

      // Invalid and rate_limited data is combined with dropped
      count[Outcome.DROPPED] += count[Outcome.INVALID];
      count[Outcome.DROPPED] += count[Outcome.RATE_LIMITED];

      usageStats.forEach(stat => {
        stat.total = stat.accepted + stat.filtered + stat.dropped.total;

        // Chart Data
        (chartStats.accepted as any[]).push({value: [stat.date, stat.accepted]});
        (chartStats.dropped as any[]).push({
          value: [stat.date, stat.dropped.total],
        } as any);
        (chartStats.filtered as any[])?.push({value: [stat.date, stat.filtered]});
      });

      return {
        cardStats: {
          total: formatUsageWithUnits(
            count.total,
            dataCategory,
            getFormatUsageOptions(dataCategory)
          ),
          accepted: formatUsageWithUnits(
            count[Outcome.ACCEPTED],
            dataCategory,
            getFormatUsageOptions(dataCategory)
          ),
          filtered: formatUsageWithUnits(
            count[Outcome.FILTERED],
            dataCategory,
            getFormatUsageOptions(dataCategory)
          ),
          dropped: formatUsageWithUnits(
            count[Outcome.DROPPED],
            dataCategory,
            getFormatUsageOptions(dataCategory)
          ),
        },
        chartStats,
      };
    } catch (err) {
      Sentry.withScope(scope => {
        scope.setContext('query', this.endpointQuery);
        scope.setContext('body', {...orgStats});
        Sentry.captureException(err);
      });

      return {
        cardStats,
        chartStats,
        dataError: new Error('Failed to parse stats data'),
      };
    }
  }

  renderCards() {
    const {loading} = this.state;

    const cardMetadata = Object.values(this.cardMetadata);

    return cardMetadata.map((card, i) => (
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

  renderChart() {
    const {loading} = this.state;
    return <UsageChart {...this.chartProps} isLoading={loading} />;
  }

  renderChartFooter = () => {
    const {handleChangeState} = this.props;
    const {loading, error} = this.state;
    const {
      chartDateInterval,
      chartTransform,
      chartDateStartDisplay,
      chartDateEndDisplay,
      chartDateTimezoneDisplay,
    } = this.chartData;

    return (
      <Footer>
        <InlineContainer>
          <FooterDate>
            <SectionHeading>{t('Date Range:')}</SectionHeading>
            <span>
              {loading || error ? (
                <NotAvailable />
              ) : (
                tct('[start] — [end] ([timezone] UTC, [interval] interval)', {
                  start: chartDateStartDisplay,
                  end: chartDateEndDisplay,
                  timezone: chartDateTimezoneDisplay,
                  interval: chartDateInterval,
                })
              )}
            </span>
          </FooterDate>
        </InlineContainer>
        <InlineContainer>
          <OptionSelector
            title={t('Type')}
            selected={chartTransform}
            options={CHART_OPTIONS_DATA_TRANSFORM}
            onChange={(val: string) =>
              handleChangeState({transform: val as ChartDataTransform})
            }
          />
        </InlineContainer>
      </Footer>
    );
  };

  renderProjectDetails() {
    const {isSingleProject} = this.props;
    const projectDetails = this.projectDetails.map((projectDetailComponent, i) => (
      <ErrorBoundary mini key={i}>
        {projectDetailComponent}
      </ErrorBoundary>
    ));
    return isSingleProject ? projectDetails : null;
  }

  renderComponent() {
    return (
      <Fragment>
        <PageGrid>
          {this.renderCards()}
          <ChartWrapper data-test-id="usage-stats-chart">
            {this.renderChart()}
          </ChartWrapper>
        </PageGrid>
        {this.renderProjectDetails()}
      </Fragment>
    );
  }
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
    grid-template-columns: repeat(4, 1fr);
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
  justify-content: space-between;
  padding: ${space(1)} ${space(3)};
  border-top: 1px solid ${p => p.theme.border};
`;
const FooterDate = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;

  > ${SectionHeading} {
    margin-right: ${space(1.5)};
  }

  > span:last-child {
    font-weight: 400;
    font-size: ${p => p.theme.fontSizeMedium};
  }
`;
