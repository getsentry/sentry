import React, {Fragment, PureComponent, type ComponentProps} from 'react';
import type {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import isEqual from 'lodash/isEqual';
import maxBy from 'lodash/maxBy';
import minBy from 'lodash/minBy';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

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
import {CompactSelect} from 'sentry/components/core/compactSelect';
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
  Organization,
} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';
import {shouldShowOnDemandMetricAlertUI} from 'sentry/utils/onDemandMetrics/features';
import {
  getCrashFreeRateSeries,
  MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
} from 'sentry/utils/sessions';
import {capitalize} from 'sentry/utils/string/capitalize';
import withApi from 'sentry/utils/withApi';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/rules/metric/constants';
import {getIsMigratedExtrapolationMode} from 'sentry/views/alerts/rules/metric/details/utils';
import {
  AlertRuleComparisonType,
  Dataset,
  EAP_EXTRAPOLATION_MODE_MAP,
  ExtrapolationMode,
  SessionsAggregate,
  TimePeriod,
  TimeWindow,
  type MetricRule,
  type Trigger,
} from 'sentry/views/alerts/rules/metric/types';
import type {SeriesSamplingInfo} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {getMetricDatasetQueryExtras} from 'sentry/views/alerts/rules/metric/utils/getMetricDatasetQueryExtras';
import {shouldUseErrorsDiscoverDataset} from 'sentry/views/alerts/rules/utils';
import type {Anomaly} from 'sentry/views/alerts/types';
import {isSessionAggregate, SESSION_AGGREGATE_TO_FIELD} from 'sentry/views/alerts/utils';
import {getComparisonMarkLines} from 'sentry/views/alerts/utils/getComparisonMarkLines';
import {
  AVAILABLE_TIME_PERIODS,
  EAP_AVAILABLE_TIME_PERIODS,
  EAP_HISTORICAL_TIME_PERIOD_MAP,
  HISTORICAL_TIME_PERIOD_MAP,
  HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS,
  TIME_PERIOD_MAP,
  TIME_WINDOW_TO_INTERVAL,
} from 'sentry/views/alerts/utils/timePeriods';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {ConfidenceFooter} from 'sentry/views/explore/spans/charts/confidenceFooter';
import {TraceItemDataset} from 'sentry/views/explore/types';

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
  theme: Theme;
  thresholdType: MetricRule['thresholdType'];
  timeWindow: MetricRule['timeWindow'];
  triggers: Trigger[];
  anomalies?: Anomaly[];
  comparisonDelta?: number;
  confidence?: Confidence;
  extrapolationMode?: ExtrapolationMode;
  formattedAggregate?: string;
  header?: React.ReactNode;
  includeHistorical?: boolean;
  isOnDemandMetricAlert?: boolean;
  onDataLoaded?: (data: EventsStats | MultiSeriesEventsStats | null) => void;
  onHistoricalDataLoaded?: (data: EventsStats | MultiSeriesEventsStats | null) => void;
  seriesSamplingInfo?: SeriesSamplingInfo;
  showTotalCount?: boolean;
  traceItemType?: TraceItemDataset;
};

const SESSION_AGGREGATE_TO_HEADING = {
  [SessionsAggregate.CRASH_FREE_SESSIONS]: t('Total Sessions'),
  [SessionsAggregate.CRASH_FREE_USERS]: t('Total Users'),
};

const noop: any = () => {};

type State = {
  adjustedExtrapolationMode: ExtrapolationMode | undefined;
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
    adjustedExtrapolationMode: undefined,
  };

  componentDidMount() {
    const {aggregate, showTotalCount, extrapolationMode, dataset, traceItemType} =
      this.props;
    if (showTotalCount && !isSessionAggregate(aggregate)) {
      this.fetchTotalCount();
    }

    // we want to show the regular extrapolated chart as we are changing the extrapolation to UNKNOWN
    // once a migrated alert is saved
    if (getIsMigratedExtrapolationMode(extrapolationMode, dataset, traceItemType)) {
      this.setState({
        adjustedExtrapolationMode: ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED,
      });
    } else {
      this.setState({adjustedExtrapolationMode: extrapolationMode});
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {
      query,
      environment,
      timeWindow,
      aggregate,
      projects,
      showTotalCount,
      extrapolationMode,
      dataset,
      traceItemType,
    } = this.props;
    const {statsPeriod} = this.state;
    if (
      !isEqual(prevProps.projects, projects) ||
      prevProps.environment !== environment ||
      prevProps.query !== query ||
      !isEqual(prevProps.timeWindow, timeWindow) ||
      !isEqual(prevState.statsPeriod, statsPeriod)
    ) {
      if (showTotalCount && !isSessionAggregate(aggregate)) {
        this.fetchTotalCount();
      }
    }
    if (
      prevProps.extrapolationMode !== this.props.extrapolationMode ||
      prevProps.dataset !== dataset ||
      prevProps.traceItemType !== traceItemType
    ) {
      if (getIsMigratedExtrapolationMode(extrapolationMode, dataset, traceItemType)) {
        this.setState({
          adjustedExtrapolationMode: ExtrapolationMode.CLIENT_AND_SERVER_WEIGHTED,
        });
      } else {
        this.setState({adjustedExtrapolationMode: extrapolationMode});
      }
    }
  }

  // Create new API Client so that historical requests aren't automatically deduplicated
  historicalAPI = new Client();

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
      traceItemType,
    } = this.props;

    const statsPeriod = this.getStatsPeriod();

    const queryExtras = getMetricDatasetQueryExtras({
      organization,
      location,
      dataset,
      newAlertOrQuery,
      traceItemType,
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
      anomalies = [],
      dataset,
      confidence,
      seriesSamplingInfo,
      traceItemType,
    } = this.props;
    const {statsPeriod, totalCount} = this.state;
    const statsPeriodOptions = this.availableTimePeriods[timeWindow];
    const period = this.getStatsPeriod();

    const error = orgFeatures.includes('alert-allow-indexed')
      ? errored || errorMessage
      : errored || errorMessage || !isQueryValid;

    const showExtrapolatedChartData =
      shouldShowOnDemandMetricAlertUI(organization) &&
      seriesAdditionalInfo?.[timeseriesData[0]?.seriesName!]?.isExtrapolatedData;

    const totalCountLabel = isSessionAggregate(aggregate)
      ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
            theme={this.props.theme}
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

        <ChartControls>
          {showTotalCount ? (
            <InlineContainer data-test-id="alert-total-events">
              {dataset === Dataset.EVENTS_ANALYTICS_PLATFORM &&
              traceItemType === TraceItemDataset.SPANS ? (
                <ConfidenceFooter
                  sampleCount={seriesSamplingInfo?.sampleCount}
                  isSampled={seriesSamplingInfo?.isSampled}
                  confidence={confidence}
                  dataScanned={seriesSamplingInfo?.dataScanned}
                />
              ) : (
                <React.Fragment>
                  <SectionHeading>{totalCountLabel}</SectionHeading>
                  <SectionValue>
                    {totalCount === null ? '\u2014' : totalCount.toLocaleString()}
                  </SectionValue>
                </React.Fragment>
              )}
            </InlineContainer>
          ) : (
            <InlineContainer />
          )}
          <InlineContainer>
            <CompactSelect
              size="sm"
              options={statsPeriodOptions.map(timePeriod => ({
                value: timePeriod,
                label: TIME_PERIOD_MAP[timePeriod as keyof typeof TIME_PERIOD_MAP],
              }))}
              value={period}
              onChange={opt => this.handleStatsPeriodChange(opt.value)}
              position="bottom-end"
              trigger={triggerProps => (
                <OverlayTrigger.Button
                  {...triggerProps}
                  borderless
                  prefix={t('Display')}
                />
              )}
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
      theme,
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
      traceItemType,
    } = this.props;

    const {adjustedExtrapolationMode} = this.state;

    const period = this.getStatsPeriod()!;
    const renderComparisonStats = Boolean(
      organization.features.includes('change-alerts') && comparisonDelta
    );

    const queryExtras = getMetricDatasetQueryExtras({
      organization,
      location,
      dataset,
      query,
      newAlertOrQuery,
      traceItemType,
    });

    if (isOnDemandMetricAlert) {
      const {sampleRate} = this.state;
      const baseProps: EventsRequestProps = {
        includeAllArgs: false,
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
        extrapolationMode: adjustedExtrapolationMode
          ? EAP_EXTRAPOLATION_MODE_MAP[adjustedExtrapolationMode]
          : undefined,
        sampling:
          adjustedExtrapolationMode === ExtrapolationMode.NONE
            ? SAMPLING_MODE.HIGH_ACCURACY
            : SAMPLING_MODE.NORMAL,
      };

      return (
        <Fragment>
          {this.props.includeHistorical ? (
            <OnDemandMetricRequest
              {...baseProps}
              api={this.historicalAPI}
              period={
                timeWindow === 5
                  ? HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS[
                      period as keyof typeof HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS
                    ]
                  : HISTORICAL_TIME_PERIOD_MAP[
                      period as keyof typeof HISTORICAL_TIME_PERIOD_MAP
                    ]
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
                  thresholdType,
                  theme
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
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        interval: TIME_WINDOW_TO_INTERVAL[timeWindow],
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
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
                  SESSION_AGGREGATE_TO_FIELD[aggregate]!
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
      sampling:
        dataset === Dataset.EVENTS_ANALYTICS_PLATFORM &&
        this.props.traceItemType === TraceItemDataset.SPANS
          ? adjustedExtrapolationMode === ExtrapolationMode.NONE
            ? SAMPLING_MODE.HIGH_ACCURACY
            : SAMPLING_MODE.NORMAL
          : undefined,

      extrapolationMode: adjustedExtrapolationMode
        ? EAP_EXTRAPOLATION_MODE_MAP[adjustedExtrapolationMode]
        : undefined,
    };

    return (
      <Fragment>
        {this.props.includeHistorical ? (
          <EventsRequest
            {...baseProps}
            api={this.historicalAPI}
            period={
              dataset === Dataset.EVENTS_ANALYTICS_PLATFORM
                ? EAP_HISTORICAL_TIME_PERIOD_MAP[
                    period as keyof typeof EAP_HISTORICAL_TIME_PERIOD_MAP
                  ]
                : timeWindow === 5
                  ? HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS[
                      period as keyof typeof HISTORICAL_TIME_PERIOD_MAP_FIVE_MINS
                    ]
                  : HISTORICAL_TIME_PERIOD_MAP[
                      period as keyof typeof HISTORICAL_TIME_PERIOD_MAP
                    ]
            }
            dataLoadedCallback={onHistoricalDataLoaded}
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
                thresholdType,
                theme
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

interface ErrorChartProps extends React.ComponentProps<'div'> {
  isAllowIndexed: boolean;
  isQueryValid: boolean;
  errorMessage?: React.ReactNode;
}

export function ErrorChart({
  isAllowIndexed,
  isQueryValid,
  errorMessage,
  ...props
}: ErrorChartProps) {
  return (
    <ChartErrorWrapper {...props}>
      <PanelAlert variant="danger">
        {!isAllowIndexed && !isQueryValid
          ? t('Your filter conditions contain an unsupported field - please review.')
          : typeof errorMessage === 'string'
            ? errorMessage
            : t('An error occurred while fetching data')}
      </PanelAlert>

      <StyledErrorPanel>
        <IconWarning variant="primary" size="lg" />
      </StyledErrorPanel>
    </ChartErrorWrapper>
  );
}
