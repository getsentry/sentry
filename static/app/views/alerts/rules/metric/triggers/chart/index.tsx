import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import capitalize from 'lodash/capitalize';
import isEqual from 'lodash/isEqual';
import maxBy from 'lodash/maxBy';
import minBy from 'lodash/minBy';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {OnDemandMetricRequest} from 'sentry/components/charts/onDemandMetricRequest';
import SessionsRequest from 'sentry/components/charts/sessionsRequest';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import {CompactSelect} from 'sentry/components/compactSelect';
import LoadingMask from 'sentry/components/loadingMask';
import PanelAlert from 'sentry/components/panels/panelAlert';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  EventsStats,
  MultiSeriesEventsStats,
  Organization,
  Project,
} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {getForceMetricsLayerQueryExtras} from 'sentry/utils/metrics/features';
import {formatMRIField} from 'sentry/utils/metrics/mri';
import {shouldShowOnDemandMetricAlertUI} from 'sentry/utils/onDemandMetrics/features';
import {
  getCrashFreeRateSeries,
  MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
} from 'sentry/utils/sessions';
import withApi from 'sentry/utils/withApi';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {shouldUseErrorsDiscoverDataset} from 'sentry/views/alerts/rules/utils';
import {isSessionAggregate, SESSION_AGGREGATE_TO_FIELD} from 'sentry/views/alerts/utils';
import {getComparisonMarkLines} from 'sentry/views/alerts/utils/getComparisonMarkLines';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

import {
  AlertRuleComparisonType,
  Dataset,
  MetricRule,
  SessionsAggregate,
  TimePeriod,
  TimeWindow,
  Trigger,
} from '../../types';
import {getMetricDatasetQueryExtras} from '../../utils/getMetricDatasetQueryExtras';

import ThresholdsChart from './thresholdsChart';

type Props = {
  aggregate: MetricRule['aggregate'];
  api: Client;
  comparisonType: AlertRuleComparisonType;
  dataset: MetricRule['dataset'];
  environment: string | null;
  isQueryValid: boolean;
  location: Location;
  newAlertOrQuery: boolean;
  organization: Organization;
  projects: Project[];
  query: MetricRule['query'];
  resolveThreshold: MetricRule['resolveThreshold'];
  thresholdType: MetricRule['thresholdType'];
  timeWindow: MetricRule['timeWindow'];
  triggers: Trigger[];
  comparisonDelta?: number;
  header?: React.ReactNode;
  isOnDemandMetricAlert?: boolean;
  onDataLoaded?: (data: EventsStats | MultiSeriesEventsStats | null) => void;
  showTotalCount?: boolean;
};

const TIME_PERIOD_MAP: Record<TimePeriod, string> = {
  [TimePeriod.SIX_HOURS]: t('Last 6 hours'),
  [TimePeriod.ONE_DAY]: t('Last 24 hours'),
  [TimePeriod.THREE_DAYS]: t('Last 3 days'),
  [TimePeriod.SEVEN_DAYS]: t('Last 7 days'),
  [TimePeriod.FOURTEEN_DAYS]: t('Last 14 days'),
};

/**
 * Just to avoid repeating it
 */
const MOST_TIME_PERIODS: readonly TimePeriod[] = [
  TimePeriod.ONE_DAY,
  TimePeriod.THREE_DAYS,
  TimePeriod.SEVEN_DAYS,
  TimePeriod.FOURTEEN_DAYS,
];

/**
 * TimeWindow determines data available in TimePeriod
 * If TimeWindow is small, lower TimePeriod to limit data points
 */
export const AVAILABLE_TIME_PERIODS: Record<TimeWindow, readonly TimePeriod[]> = {
  [TimeWindow.ONE_MINUTE]: [
    TimePeriod.SIX_HOURS,
    TimePeriod.ONE_DAY,
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
  ],
  [TimeWindow.FIVE_MINUTES]: MOST_TIME_PERIODS,
  [TimeWindow.TEN_MINUTES]: MOST_TIME_PERIODS,
  [TimeWindow.FIFTEEN_MINUTES]: MOST_TIME_PERIODS,
  [TimeWindow.THIRTY_MINUTES]: MOST_TIME_PERIODS,
  [TimeWindow.ONE_HOUR]: MOST_TIME_PERIODS,
  [TimeWindow.TWO_HOURS]: MOST_TIME_PERIODS,
  [TimeWindow.FOUR_HOURS]: [
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
  ],
  [TimeWindow.ONE_DAY]: [TimePeriod.FOURTEEN_DAYS],
};

const TIME_WINDOW_TO_SESSION_INTERVAL = {
  [TimeWindow.THIRTY_MINUTES]: '30m',
  [TimeWindow.ONE_HOUR]: '1h',
  [TimeWindow.TWO_HOURS]: '2h',
  [TimeWindow.FOUR_HOURS]: '4h',
  [TimeWindow.ONE_DAY]: '1d',
};

const SESSION_AGGREGATE_TO_HEADING = {
  [SessionsAggregate.CRASH_FREE_SESSIONS]: t('Total Sessions'),
  [SessionsAggregate.CRASH_FREE_USERS]: t('Total Users'),
};

type State = {
  sampleRate: number;
  statsPeriod: TimePeriod;
  totalCount: number | null;
};

const getStatsPeriodFromQuery = (
  queryParam: string | string[] | null | undefined
): TimePeriod => {
  if (typeof queryParam !== 'string') {
    return TimePeriod.SEVEN_DAYS;
  }
  const inMinutes = parsePeriodToHours(queryParam || '') * 60;

  switch (inMinutes) {
    case 6 * 60:
      return TimePeriod.SIX_HOURS;
    case 24 * 60:
      return TimePeriod.ONE_DAY;
    case 3 * 24 * 60:
      return TimePeriod.THREE_DAYS;
    case 9999:
      return TimePeriod.SEVEN_DAYS;
    case 14 * 24 * 60:
      return TimePeriod.FOURTEEN_DAYS;
    default:
      return TimePeriod.SEVEN_DAYS;
  }
};

/**
 * This is a chart to be used in Metric Alert rules that fetches events based on
 * query, timewindow, and aggregations.
 */
class TriggersChart extends PureComponent<Props, State> {
  state: State = {
    statsPeriod: getStatsPeriodFromQuery(this.props.location.query.statsPeriod),
    totalCount: null,
    sampleRate: 1,
  };

  componentDidMount() {
    const {aggregate, showTotalCount} = this.props;
    if (showTotalCount && !isSessionAggregate(aggregate)) {
      this.fetchTotalCount();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {query, environment, timeWindow, aggregate, projects, showTotalCount} =
      this.props;
    const {statsPeriod} = this.state;
    if (
      showTotalCount &&
      !isSessionAggregate(aggregate) &&
      (!isEqual(prevProps.projects, projects) ||
        prevProps.environment !== environment ||
        prevProps.query !== query ||
        !isEqual(prevProps.timeWindow, timeWindow) ||
        !isEqual(prevState.statsPeriod, statsPeriod))
    ) {
      this.fetchTotalCount();
    }
  }

  get availableTimePeriods() {
    // We need to special case sessions, because sub-hour windows are available
    // only when time period is six hours or less (backend limitation)
    if (isSessionAggregate(this.props.aggregate)) {
      return {
        ...AVAILABLE_TIME_PERIODS,
        [TimeWindow.THIRTY_MINUTES]: [TimePeriod.SIX_HOURS],
      };
    }

    return AVAILABLE_TIME_PERIODS;
  }

  handleStatsPeriodChange = (timePeriod: TimePeriod) => {
    this.setState({statsPeriod: timePeriod});
  };

  getStatsPeriod = () => {
    const {statsPeriod} = this.state;
    const {timeWindow} = this.props;
    const statsPeriodOptions = this.availableTimePeriods[timeWindow];
    const period = statsPeriodOptions.includes(statsPeriod)
      ? statsPeriod
      : statsPeriodOptions[statsPeriodOptions.length - 1];
    return period;
  };

  get comparisonSeriesName() {
    return capitalize(
      COMPARISON_DELTA_OPTIONS.find(({value}) => value === this.props.comparisonDelta)
        ?.label || ''
    );
  }

  async fetchTotalCount() {
    const {
      api,
      organization,
      location,
      newAlertOrQuery,
      environment,
      projects,
      query,
      dataset,
    } = this.props;

    const statsPeriod = this.getStatsPeriod();

    const queryExtras = getMetricDatasetQueryExtras({
      organization,
      location,
      dataset,
      newAlertOrQuery,
    });

    let queryDataset = queryExtras.dataset as undefined | DiscoverDatasets;

    if (shouldUseErrorsDiscoverDataset(query, dataset)) {
      queryDataset = DiscoverDatasets.ERRORS;
    }

    try {
      const totalCount = await fetchTotalCount(api, organization.slug, {
        field: [],
        project: projects.map(({id}) => id),
        query,
        statsPeriod,
        environment: environment ? [environment] : [],
        dataset: queryDataset,
        ...getForceMetricsLayerQueryExtras(organization, dataset),
      });
      this.setState({totalCount});
    } catch (e) {
      this.setState({totalCount: null});
    }
  }

  renderChart({
    isLoading,
    isReloading,
    timeseriesData = [],
    comparisonData,
    comparisonMarkLines,
    errorMessage,
    minutesThresholdToDisplaySeconds,
    isQueryValid,
    errored,
    orgFeatures,
    seriesAdditionalInfo,
  }: {
    isLoading: boolean;
    isQueryValid: boolean;
    isReloading: boolean;
    orgFeatures: string[];
    timeseriesData: Series[];
    comparisonData?: Series[];
    comparisonMarkLines?: LineChartSeries[];
    errorMessage?: string;
    errored?: boolean;
    minutesThresholdToDisplaySeconds?: number;
    seriesAdditionalInfo?: Record<string, any>;
  }) {
    const {
      triggers,
      resolveThreshold,
      thresholdType,
      header,
      timeWindow,
      aggregate,
      comparisonType,
      organization,
      showTotalCount,
    } = this.props;
    const {statsPeriod, totalCount} = this.state;
    const statsPeriodOptions = this.availableTimePeriods[timeWindow];
    const period = this.getStatsPeriod();

    const error = orgFeatures.includes('alert-allow-indexed')
      ? errored || errorMessage
      : errored || errorMessage || !isQueryValid;

    const showExtrapolatedChartData =
      shouldShowOnDemandMetricAlertUI(organization) &&
      seriesAdditionalInfo?.[timeseriesData[0]?.seriesName]?.isExtrapolatedData;

    const totalCountLabel = isSessionAggregate(aggregate)
      ? SESSION_AGGREGATE_TO_HEADING[aggregate]
      : showExtrapolatedChartData
      ? t('Estimated Transactions')
      : t('Total');

    return (
      <Fragment>
        {header}
        <TransparentLoadingMask visible={isReloading} />
        {isLoading && !error ? (
          <ChartPlaceholder />
        ) : error ? (
          <ErrorChart
            isAllowIndexed={orgFeatures.includes('alert-allow-indexed')}
            errorMessage={errorMessage}
            isQueryValid={isQueryValid}
          />
        ) : (
          <ThresholdsChart
            period={statsPeriod}
            minValue={minBy(timeseriesData[0]?.data, ({value}) => value)?.value}
            maxValue={maxBy(timeseriesData[0]?.data, ({value}) => value)?.value}
            data={timeseriesData}
            comparisonData={comparisonData ?? []}
            comparisonSeriesName={this.comparisonSeriesName}
            comparisonMarkLines={comparisonMarkLines ?? []}
            hideThresholdLines={comparisonType === AlertRuleComparisonType.CHANGE}
            triggers={triggers}
            resolveThreshold={resolveThreshold}
            thresholdType={thresholdType}
            aggregate={aggregate}
            minutesThresholdToDisplaySeconds={minutesThresholdToDisplaySeconds}
            isExtrapolatedData={showExtrapolatedChartData}
          />
        )}

        <ChartControls>
          {showTotalCount ? (
            <InlineContainer data-test-id="alert-total-events">
              <SectionHeading>{totalCountLabel}</SectionHeading>
              <SectionValue>
                {totalCount !== null ? totalCount.toLocaleString() : '\u2014'}
              </SectionValue>
            </InlineContainer>
          ) : (
            <InlineContainer />
          )}
          <InlineContainer>
            <CompactSelect
              size="sm"
              options={statsPeriodOptions.map(timePeriod => ({
                value: timePeriod,
                label: TIME_PERIOD_MAP[timePeriod],
              }))}
              value={period}
              onChange={opt => this.handleStatsPeriodChange(opt.value)}
              position="bottom-end"
              triggerProps={{
                borderless: true,
                prefix: t('Display'),
              }}
              disabled={isLoading || isReloading}
            />
          </InlineContainer>
        </ChartControls>
      </Fragment>
    );
  }

  render() {
    const {
      api,
      organization,
      projects,
      timeWindow,
      query,
      location,
      aggregate,
      dataset,
      newAlertOrQuery,
      onDataLoaded,
      environment,
      comparisonDelta,
      triggers,
      thresholdType,
      isQueryValid,
      isOnDemandMetricAlert,
    } = this.props;

    const period = this.getStatsPeriod();
    const renderComparisonStats = Boolean(
      organization.features.includes('change-alerts') && comparisonDelta
    );

    const queryExtras = {
      ...getMetricDatasetQueryExtras({
        organization,
        location,
        dataset,
        newAlertOrQuery,
      }),
      ...getForceMetricsLayerQueryExtras(organization, dataset),
      ...(shouldUseErrorsDiscoverDataset(query, dataset)
        ? {dataset: DiscoverDatasets.ERRORS}
        : {}),
    };

    if (isOnDemandMetricAlert) {
      return (
        <OnDemandMetricRequest
          api={api}
          organization={organization}
          query={query}
          environment={environment ? [environment] : undefined}
          project={projects.map(({id}) => Number(id))}
          interval={`${timeWindow}m`}
          comparisonDelta={comparisonDelta && comparisonDelta * 60}
          period={period}
          yAxis={aggregate}
          includePrevious={false}
          currentSeriesNames={[aggregate]}
          partial={false}
          queryExtras={queryExtras}
          sampleRate={this.state.sampleRate}
          dataLoadedCallback={onDataLoaded}
        >
          {({
            loading,
            errored,
            errorMessage,
            reloading,
            timeseriesData,
            comparisonTimeseriesData,
            seriesAdditionalInfo,
          }) => {
            let comparisonMarkLines: LineChartSeries[] = [];
            if (renderComparisonStats && comparisonTimeseriesData) {
              comparisonMarkLines = getComparisonMarkLines(
                timeseriesData,
                comparisonTimeseriesData,
                timeWindow,
                triggers,
                thresholdType
              );
            }

            return this.renderChart({
              timeseriesData: timeseriesData as Series[],
              isLoading: loading,
              isReloading: reloading,
              comparisonData: comparisonTimeseriesData,
              comparisonMarkLines,
              errorMessage,
              isQueryValid,
              errored,
              orgFeatures: organization.features,
              seriesAdditionalInfo,
            });
          }}
        </OnDemandMetricRequest>
      );
    }

    return isSessionAggregate(aggregate) ? (
      <SessionsRequest
        api={api}
        organization={organization}
        project={projects.map(({id}) => Number(id))}
        environment={environment ? [environment] : undefined}
        statsPeriod={period}
        query={query}
        interval={TIME_WINDOW_TO_SESSION_INTERVAL[timeWindow]}
        field={SESSION_AGGREGATE_TO_FIELD[aggregate]}
        groupBy={['session.status']}
      >
        {({loading, errored, reloading, response}) => {
          const {groups, intervals} = response || {};
          const sessionTimeSeries = [
            {
              seriesName:
                AlertWizardAlertNames[
                  getAlertTypeFromAggregateDataset({aggregate, dataset: Dataset.SESSIONS})
                ],
              data: getCrashFreeRateSeries(
                groups,
                intervals,
                SESSION_AGGREGATE_TO_FIELD[aggregate]
              ),
            },
          ];

          return this.renderChart({
            timeseriesData: sessionTimeSeries,
            isLoading: loading,
            isReloading: reloading,
            comparisonData: undefined,
            comparisonMarkLines: undefined,
            minutesThresholdToDisplaySeconds: MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
            isQueryValid,
            errored,
            orgFeatures: organization.features,
          });
        }}
      </SessionsRequest>
    ) : (
      <EventsRequest
        api={api}
        organization={organization}
        query={query}
        environment={environment ? [environment] : undefined}
        project={projects.map(({id}) => Number(id))}
        interval={`${timeWindow}m`}
        comparisonDelta={comparisonDelta && comparisonDelta * 60}
        period={period}
        yAxis={aggregate}
        includePrevious={false}
        currentSeriesNames={[formatMRIField(aggregate)]}
        partial={false}
        queryExtras={queryExtras}
        useOnDemandMetrics
        dataLoadedCallback={onDataLoaded}
      >
        {({
          loading,
          errored,
          errorMessage,
          reloading,
          timeseriesData,
          comparisonTimeseriesData,
        }) => {
          let comparisonMarkLines: LineChartSeries[] = [];
          if (renderComparisonStats && comparisonTimeseriesData) {
            comparisonMarkLines = getComparisonMarkLines(
              timeseriesData,
              comparisonTimeseriesData,
              timeWindow,
              triggers,
              thresholdType
            );
          }

          return this.renderChart({
            timeseriesData: timeseriesData as Series[],
            isLoading: loading,
            isReloading: reloading,
            comparisonData: comparisonTimeseriesData,
            comparisonMarkLines,
            errorMessage,
            isQueryValid,
            errored,
            orgFeatures: organization.features,
          });
        }}
      </EventsRequest>
    );
  }
}

export default withApi(TriggersChart);

const TransparentLoadingMask = styled(LoadingMask)<{visible: boolean}>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

const ChartPlaceholder = styled(Placeholder)`
  /* Height and margin should add up to graph size (200px) */
  margin: 0 0 ${space(2)};
  height: 184px;
`;

const StyledErrorPanel = styled(ErrorPanel)`
  /* Height and margin should with the alert should match up placeholder height of (184px) */
  padding: ${space(2)};
  height: 119px;
`;

const ChartErrorWrapper = styled('div')`
  margin-top: ${space(2)};
`;

function ErrorChart({isAllowIndexed, isQueryValid, errorMessage}) {
  return (
    <ChartErrorWrapper>
      <PanelAlert type="error">
        {!isAllowIndexed && !isQueryValid
          ? t('Your filter conditions contain an unsupported field - please review.')
          : typeof errorMessage === 'string'
          ? errorMessage
          : t('An error occurred while fetching data')}
      </PanelAlert>

      <StyledErrorPanel>
        <IconWarning color="gray500" size="lg" />
      </StyledErrorPanel>
    </ChartErrorWrapper>
  );
}
