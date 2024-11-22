import type {MouseEvent as ReactMouseEvent} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import moment from 'moment-timezone';

import {navigateTo} from 'sentry/actionCreators/navigation';
import type {TooltipSubLabel} from 'sentry/components/charts/components/tooltip';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {InlineContainer, SectionHeading} from 'sentry/components/charts/styles';
import type {DateTimeObject} from 'sentry/components/charts/utils';
import {getSeriesApiInterval} from 'sentry/components/charts/utils';
import {Flex} from 'sentry/components/container/flex';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import ErrorBoundary from 'sentry/components/errorBoundary';
import ExternalLink from 'sentry/components/links/externalLink';
import NotAvailable from 'sentry/components/notAvailable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import type {ScoreCardProps} from 'sentry/components/scoreCard';
import ScoreCard from 'sentry/components/scoreCard';
import SwitchButton from 'sentry/components/switchButton';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategoryInfo, IntervalPeriod} from 'sentry/types/core';
import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {hasDynamicSamplingCustomFeature} from 'sentry/utils/dynamicSampling/features';

import {
  FORMAT_DATETIME_DAILY,
  FORMAT_DATETIME_HOURLY,
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

export interface UsageStatsOrganizationProps extends WithRouterProps {
  dataCategory: DataCategoryInfo['plural'];
  dataCategoryApiName: DataCategoryInfo['apiName'];
  dataCategoryName: string;
  dataDatetime: DateTimeObject;
  handleChangeState: (state: {
    clientDiscard?: boolean;
    dataCategory?: DataCategoryInfo['plural'];
    pagePeriod?: string | null;
    transform?: ChartDataTransform;
  }) => void;
  isSingleProject: boolean;
  organization: Organization;
  projectIds: number[];
  chartTransform?: string;
  clientDiscard?: boolean;
}

type UsageStatsOrganizationState = {
  orgStats: UsageSeries | undefined;
  metricOrgStats?: UsageSeries | undefined;
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
    const {
      dataDatetime: prevDateTime,
      projectIds: prevProjectIds,
      dataCategoryApiName: prevDataCategoryApiName,
    } = prevProps;
    const {
      dataDatetime: currDateTime,
      projectIds: currProjectIds,
      dataCategoryApiName: currentDataCategoryApiName,
    } = this.props;

    if (
      prevDateTime.start !== currDateTime.start ||
      prevDateTime.end !== currDateTime.end ||
      prevDateTime.period !== currDateTime.period ||
      prevDateTime.utc !== currDateTime.utc ||
      prevDataCategoryApiName !== currentDataCategoryApiName ||
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
    const {dataDatetime, projectIds, dataCategoryApiName} = this.props;

    const queryDatetime = this.endpointQueryDatetime;

    const groupBy = ['outcome', 'reason'];
    const category: string[] = [dataCategoryApiName];

    if (
      hasDynamicSamplingCustomFeature(this.props.organization) &&
      dataCategoryApiName === 'span'
    ) {
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

  get chartData(): {
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
  } {
    return {
      ...mapSeriesToChart({
        orgStats: this.state.orgStats,
        chartDateInterval: this.chartDateRange.chartDateInterval,
        chartDateUtc: this.chartDateRange.chartDateUtc,
        dataCategory: this.props.dataCategory,
        endpointQuery: this.endpointQuery,
      }),
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
    const {dataCategory, clientDiscard, handleChangeState} = this.props;
    const {error, errors, loading} = this.state;
    const {
      chartStats,
      dataError,
      chartDateInterval,
      chartDateStart,
      chartDateEnd,
      chartDateUtc,
      chartTransform,
      chartSubLabels,
    } = this.chartData;

    const hasError = error || !!dataError;
    const chartErrors: any = dataError ? {...errors, data: dataError} : errors; // TODO(ts): AsyncComponent
    const chartProps = {
      isLoading: loading,
      isError: hasError,
      errors: chartErrors,
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
                    onClick={() => this.handleOnDocsClick('chart-title')}
                  />
                ),
              }
            )}
            isHoverable
          />
        </Fragment>
      ),
      footer: this.renderChartFooter(),
      dataCategory,
      dataTransform: chartTransform,
      usageDateStart: chartDateStart,
      usageDateEnd: chartDateEnd,
      usageDateShowUtc: chartDateUtc,
      usageDateInterval: chartDateInterval,
      usageStats: chartStats,
      chartTooltip: {
        subLabels: chartSubLabels,
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
    } as UsageChartProps;

    return chartProps;
  }

  handleOnDocsClick = (
    source:
      | 'card-accepted'
      | 'card-filtered'
      | 'card-rate-limited'
      | 'card-invalid'
      | 'chart-title'
  ) => {
    const {organization, dataCategory} = this.props;
    trackAnalytics('stats.docs_clicked', {
      organization,
      source,
      dataCategory,
    });
  };

  get cardMetadata() {
    const {
      dataCategory,
      dataCategoryName,
      organization,
      projectIds,
      router,
      dataCategoryApiName,
    } = this.props;
    const {total, accepted, accepted_stored, invalid, rateLimited, filtered} =
      this.chartData.cardStats;
    const dataCategoryNameLower = dataCategoryName.toLowerCase();

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
        help: tct(
          'Accepted [dataCategory] were successfully processed by Sentry. For more information, read our [docsLink:docs].',
          {
            dataCategory: dataCategoryNameLower,
            docsLink: (
              <ExternalLink
                href="https://docs.sentry.io/product/stats/#accepted"
                onClick={() => this.handleOnDocsClick('card-accepted')}
              />
            ),
          }
        ),
        score: accepted,
        trend:
          dataCategoryApiName === 'span' && accepted_stored ? (
            t('%s stored', accepted_stored)
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
            dataCategory: dataCategoryNameLower,
            filterSettings: (
              <a href="#" onClick={event => navigateToInboundFilterSettings(event)} />
            ),
            docsLink: (
              <ExternalLink
                href="https://docs.sentry.io/product/stats/#filtered"
                onClick={() => this.handleOnDocsClick('card-filtered')}
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
            dataCategory: dataCategoryNameLower,
            docsLink: (
              <ExternalLink
                href="https://docs.sentry.io/product/stats/#rate-limited"
                onClick={() => this.handleOnDocsClick('card-rate-limited')}
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
            dataCategory: dataCategoryNameLower,
            docsLink: (
              <ExternalLink
                href="https://docs.sentry.io/product/stats/#invalid"
                onClick={() => this.handleOnDocsClick('card-invalid')}
              />
            ),
          }
        ),
        score: invalid,
      },
    };
    return cardMetadata;
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
    const {handleChangeState, clientDiscard} = this.props;
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
          {(this.chartData.chartStats.clientDiscard ?? []).length > 0 && (
            <Flex align="center" gap={space(1)}>
              <strong>{t('Show client-discarded data:')}</strong>
              <SwitchButton
                toggle={() => {
                  handleChangeState({clientDiscard: !clientDiscard});
                }}
                isActive={clientDiscard}
              />
            </Flex>
          )}
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
