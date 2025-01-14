import {type ComponentProps, Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';
import maxBy from 'lodash/maxBy';
import minBy from 'lodash/minBy';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import {Client} from 'sentry/api';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import EventsRequest, {
  type EventsRequestProps,
} from 'sentry/components/charts/eventsRequest';
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
import type {Series} from 'sentry/types/echarts';
import type {
  Confidence,
  EventsStats,
  MultiSeriesEventsStats,
  NewQuery,
  Organization,
} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {doDiscoverQuery} from 'sentry/utils/discover/genericDiscoverQuery';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {getForceMetricsLayerQueryExtras} from 'sentry/utils/metrics/features';
import {shouldShowOnDemandMetricAlertUI} from 'sentry/utils/onDemandMetrics/features';
import {
  getCrashFreeRateSeries,
  MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
} from 'sentry/utils/sessions';
import {capitalize} from 'sentry/utils/string/capitalize';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import withApi from 'sentry/utils/withApi';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {shouldUseErrorsDiscoverDataset} from 'sentry/views/alerts/rules/utils';
import type {Anomaly} from 'sentry/views/alerts/types';
import {isSessionAggregate, SESSION_AGGREGATE_TO_FIELD} from 'sentry/views/alerts/utils';
import {getComparisonMarkLines} from 'sentry/views/alerts/utils/getComparisonMarkLines';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';
import {ConfidenceFooter} from 'sentry/views/explore/charts/confidenceFooter';

import type {MetricRule, Trigger} from '../../types';
import {
  AlertRuleComparisonType,
  Dataset,
  SessionsAggregate,
  TimePeriod,
  TimeWindow,
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
  anomalies?: Anomaly[];
  comparisonDelta?: number;
  confidence?: Confidence;
  formattedAggregate?: string;
  header?: React.ReactNode;
  includeConfidence?: boolean;
  includeHistorical?: boolean;
  isOnDemandMetricAlert?: boolean;
  onConfidenceDataLoaded?: (data: EventsStats | MultiSeriesEventsStats | null) => void;
  onDataLoaded?: (data: EventsStats | MultiSeriesEventsStats | null) => void;
  onHistoricalDataLoaded?: (data: EventsStats | MultiSeriesEventsStats | null) => void;
  showTotalCount?: boolean;
};

type TimePeriodMap = Omit<Record<TimePeriod, string>, TimePeriod.TWENTY_EIGHT_DAYS>;

const TIME_PERIOD_MAP: TimePeriodMap = {
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

const MOST_EAP_TIME_PERIOD = [
  TimePeriod.ONE_DAY,
  TimePeriod.THREE_DAYS,
  TimePeriod.SEVEN_DAYS,
];

const EAP_AVAILABLE_TIME_PERIODS = {
  [TimeWindow.ONE_MINUTE]: [], // One minute intervals are not allowed on EAP Alerts
  [TimeWindow.FIVE_MINUTES]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.TEN_MINUTES]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.FIFTEEN_MINUTES]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.THIRTY_MINUTES]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.ONE_HOUR]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.TWO_HOURS]: MOST_EAP_TIME_PERIOD,
  [TimeWindow.FOUR_HOURS]: [TimePeriod.SEVEN_DAYS],
  [TimeWindow.ONE_DAY]: [TimePeriod.SEVEN_DAYS],
};

export const TIME_WINDOW_TO_INTERVAL = {
  [TimeWindow.FIVE_MINUTES]: '5m',
  [TimeWindow.TEN_MINUTES]: '10m',
  [TimeWindow.FIFTEEN_MINUTES]: '15m',
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

const HISTORICAL_TIME_PERIOD_MAP: TimePeriodMap = {
  [TimePeriod.SIX_HOURS]: '678h',
  [TimePeriod.ONE_DAY]: '29d',
  [TimePeriod.THREE_DAYS]: '31d',
  [TimePeriod.SEVEN_DAYS]: '35d',
  [TimePeriod.FOURTEEN_DAYS]: '42d',
};

const HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS: TimePeriodMap = {
  ...HISTORICAL_TIME_PERIOD_MAP,
  [TimePeriod.SEVEN_DAYS]: '28d', // fetching 28 + 7 days of historical data at 5 minute increments exceeds the max number of data points that snuba can return
  [TimePeriod.FOURTEEN_DAYS]: '28d', // fetching 28 + 14 days of historical data at 5 minute increments exceeds the max number of data points that snuba can return
};

const noop: any = () => {};

type State = {
  extrapolationSampleCount: number | null;
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
    extrapolationSampleCount: null,
  };

  componentDidMount() {
    const {aggregate, showTotalCount} = this.props;
    if (showTotalCount && !isSessionAggregate(aggregate)) {
      this.fetchTotalCount();
    }
    if (this.props.dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
      this.fetchExtrapolationSampleCount();
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
    if (this.props.dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
      this.fetchExtrapolationSampleCount();
    }
  }

  // Create new API Client so that historical requests aren't automatically deduplicated
  historicalAPI = new Client();
  confidenceAPI = new Client();

  get availableTimePeriods() {
    // We need to special case sessions, because sub-hour windows are available
    // only when time period is six hours or less (backend limitation)
    if (isSessionAggregate(this.props.aggregate)) {
      return {
        ...AVAILABLE_TIME_PERIODS,
        [TimeWindow.THIRTY_MINUTES]: [TimePeriod.SIX_HOURS],
      };
    }

    if (this.props.dataset === Dataset.EVENTS_ANALYTICS_PLATFORM) {
      return EAP_AVAILABLE_TIME_PERIODS;
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
    const queryOverride = (queryExtras.query as string | undefined) ?? query;

    if (shouldUseErrorsDiscoverDataset(query, dataset, organization)) {
      queryDataset = DiscoverDatasets.ERRORS;
    }

    try {
      const totalCount = await fetchTotalCount(api, organization.slug, {
        field: [],
        project: projects.map(({id}) => id),
        query: queryOverride,
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

  async fetchExtrapolationSampleCount() {
    const {location, api, organization, environment, projects, query} = this.props;
    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    const discoverQuery: NewQuery = {
      id: undefined,
      name: 'Alerts - Extrapolation Meta',
      fields: ['count_sample()', 'min(sampling_rate)'],
      query: search.formatString(),
      version: 2,
      dataset: DiscoverDatasets.SPANS_EAP_RPC,
    };

    const eventView = EventView.fromNewQueryWithPageFilters(discoverQuery, {
      datetime: {
        period: TimePeriod.SEVEN_DAYS,
        start: null,
        end: null,
        utc: false,
      },
      environments: environment ? [environment] : [],
      projects: projects.map(({id}) => Number(id)),
    });

    const response = await doDiscoverQuery<TableData>(
      api,
      `/organizations/${organization.slug}/events/`,
      eventView.getEventsAPIPayload(location)
    );

    const extrapolationSampleCount = response[0]?.data?.[0]?.['count_sample()'];
    this.setState({
      extrapolationSampleCount: extrapolationSampleCount
        ? Number(extrapolationSampleCount)
        : null,
    });
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
      anomalies = [],
      confidence,
      dataset,
    } = this.props;
    const {statsPeriod, totalCount, extrapolationSampleCount} = this.state;
    const statsPeriodOptions = this.availableTimePeriods[timeWindow];
    const period = this.getStatsPeriod();

    const error = orgFeatures.includes('alert-allow-indexed')
      ? errored || errorMessage
      : errored || errorMessage || !isQueryValid;

    const showExtrapolatedChartData =
      shouldShowOnDemandMetricAlertUI(organization) &&
      seriesAdditionalInfo?.[timeseriesData[0]!?.seriesName]?.isExtrapolatedData;

    const totalCountLabel = isSessionAggregate(aggregate)
      ? // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        SESSION_AGGREGATE_TO_HEADING[aggregate]
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
            hideThresholdLines={comparisonType !== AlertRuleComparisonType.COUNT}
            triggers={triggers}
            anomalies={anomalies}
            resolveThreshold={resolveThreshold}
            thresholdType={thresholdType}
            aggregate={aggregate}
            minutesThresholdToDisplaySeconds={minutesThresholdToDisplaySeconds}
            isExtrapolatedData={showExtrapolatedChartData}
          />
        )}

        {dataset === Dataset.EVENTS_ANALYTICS_PLATFORM && (
          <ChartFooter>
            <ConfidenceFooter
              sampleCount={extrapolationSampleCount ?? undefined}
              confidence={confidence}
            />
          </ChartFooter>
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
                // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                label: TIME_PERIOD_MAP[timePeriod],
              }))}
              value={period}
              onChange={opt => this.handleStatsPeriodChange(opt.value)}
              position="bottom-end"
              triggerProps={{
                borderless: true,
                prefix: t('Display'),
              }}
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
      onHistoricalDataLoaded,
      environment,
      formattedAggregate,
      comparisonDelta,
      triggers,
      thresholdType,
      isQueryValid,
      isOnDemandMetricAlert,
      onConfidenceDataLoaded,
    } = this.props;

    const period = this.getStatsPeriod()!;
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
      ...(shouldUseErrorsDiscoverDataset(query, dataset, organization)
        ? {dataset: DiscoverDatasets.ERRORS}
        : {}),
    };

    if (isOnDemandMetricAlert) {
      const {sampleRate} = this.state;
      const baseProps: EventsRequestProps = {
        api,
        organization,
        query,
        queryExtras,
        sampleRate,
        period,
        environment: environment ? [environment] : undefined,
        project: projects.map(({id}) => Number(id)),
        interval: `${timeWindow}m`,
        comparisonDelta: comparisonDelta ? comparisonDelta * 60 : undefined,
        yAxis: aggregate,
        includePrevious: false,
        currentSeriesNames: [formattedAggregate || aggregate],
        partial: false,
        limit: 15,
        children: noop,
      };

      return (
        <Fragment>
          {this.props.includeHistorical ? (
            <OnDemandMetricRequest
              {...baseProps}
              api={this.historicalAPI}
              period={
                timeWindow === 5
                  ? // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS[period]!
                  : // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                    HISTORICAL_TIME_PERIOD_MAP[period]!
              }
              dataLoadedCallback={onHistoricalDataLoaded}
            />
          ) : null}
          <OnDemandMetricRequest {...baseProps} dataLoadedCallback={onDataLoaded}>
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
        </Fragment>
      );
    }

    if (isSessionAggregate(aggregate)) {
      const baseProps: ComponentProps<typeof SessionsRequest> = {
        api,
        organization,
        project: projects.map(({id}) => Number(id)),
        environment: environment ? [environment] : undefined,
        statsPeriod: period,
        query,
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        interval: TIME_WINDOW_TO_INTERVAL[timeWindow],
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        field: SESSION_AGGREGATE_TO_FIELD[aggregate],
        groupBy: ['session.status'],
        children: noop,
      };
      return (
        <SessionsRequest {...baseProps}>
          {({loading, errored, reloading, response}) => {
            const {groups, intervals} = response || {};
            const sessionTimeSeries = [
              {
                seriesName:
                  AlertWizardAlertNames[
                    getAlertTypeFromAggregateDataset({
                      aggregate,
                      dataset: Dataset.SESSIONS,
                    })
                  ],
                data: getCrashFreeRateSeries(
                  groups,
                  intervals,
                  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
      );
    }

    const useRpc = dataset === Dataset.EVENTS_ANALYTICS_PLATFORM;

    const baseProps = {
      api,
      organization,
      query,
      period,
      queryExtras,
      environment: environment ? [environment] : undefined,
      project: projects.map(({id}) => Number(id)),
      interval: `${timeWindow}m`,
      comparisonDelta: comparisonDelta ? comparisonDelta * 60 : undefined,
      yAxis: aggregate,
      includePrevious: false,
      currentSeriesNames: [formattedAggregate || aggregate],
      partial: false,
      useRpc,
    };

    return (
      <Fragment>
        {this.props.includeHistorical ? (
          <EventsRequest
            {...baseProps}
            api={this.historicalAPI}
            period={
              timeWindow === 5
                ? // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS[period]!
                : // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
                  HISTORICAL_TIME_PERIOD_MAP[period]!
            }
            dataLoadedCallback={onHistoricalDataLoaded}
          >
            {noop}
          </EventsRequest>
        ) : null}
        {this.props.includeConfidence ? (
          <EventsRequest
            {...baseProps}
            api={this.confidenceAPI}
            period={TimePeriod.SEVEN_DAYS}
            dataLoadedCallback={onConfidenceDataLoaded}
          >
            {noop}
          </EventsRequest>
        ) : null}
        <EventsRequest {...baseProps} period={period} dataLoadedCallback={onDataLoaded}>
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
      </Fragment>
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

export function ErrorChart({isAllowIndexed, isQueryValid, errorMessage, ...props}: any) {
  return (
    <ChartErrorWrapper {...props}>
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

const ChartFooter = styled('div')`
  margin: 0 ${space(2)} ${space(2)} ${space(2)};
`;
