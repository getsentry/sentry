import * as React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';
import maxBy from 'lodash/maxBy';
import minBy from 'lodash/minBy';

import {fetchTotalCount} from 'sentry/actionCreators/events';
import {Client} from 'sentry/api';
import EventsRequest from 'sentry/components/charts/eventsRequest';
import {LineChartSeries} from 'sentry/components/charts/lineChart';
import OptionSelector from 'sentry/components/charts/optionSelector';
import SessionsRequest from 'sentry/components/charts/sessionsRequest';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import LoadingMask from 'sentry/components/loadingMask';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import type {Series} from 'sentry/types/echarts';
import {
  getCrashFreeRateSeries,
  MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
} from 'sentry/utils/sessions';
import withApi from 'sentry/utils/withApi';
import {getComparisonMarkLines} from 'sentry/views/alerts/changeAlerts/comparisonMarklines';
import {COMPARISON_DELTA_OPTIONS} from 'sentry/views/alerts/incidentRules/constants';
import {isSessionAggregate, SESSION_AGGREGATE_TO_FIELD} from 'sentry/views/alerts/utils';
import {AlertWizardAlertNames} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';

import {
  AlertRuleComparisonType,
  Dataset,
  IncidentRule,
  SessionsAggregate,
  TimePeriod,
  TimeWindow,
  Trigger,
} from '../../types';

import ThresholdsChart from './thresholdsChart';

type Props = {
  aggregate: IncidentRule['aggregate'];
  api: Client;
  comparisonType: AlertRuleComparisonType;

  environment: string | null;
  organization: Organization;
  projects: Project[];
  query: IncidentRule['query'];
  resolveThreshold: IncidentRule['resolveThreshold'];
  thresholdType: IncidentRule['thresholdType'];
  timeWindow: IncidentRule['timeWindow'];
  triggers: Trigger[];
  comparisonDelta?: number;
  header?: React.ReactNode;
};

const TIME_PERIOD_MAP: Record<TimePeriod, string> = {
  [TimePeriod.SIX_HOURS]: t('Last 6 hours'),
  [TimePeriod.ONE_DAY]: t('Last 24 hours'),
  [TimePeriod.THREE_DAYS]: t('Last 3 days'),
  [TimePeriod.SEVEN_DAYS]: t('Last 7 days'),
  [TimePeriod.FOURTEEN_DAYS]: t('Last 14 days'),
  [TimePeriod.THIRTY_DAYS]: t('Last 30 days'),
};

/**
 * Just to avoid repeating it
 */
const MOST_TIME_PERIODS: readonly TimePeriod[] = [
  TimePeriod.ONE_DAY,
  TimePeriod.THREE_DAYS,
  TimePeriod.SEVEN_DAYS,
  TimePeriod.FOURTEEN_DAYS,
  TimePeriod.THIRTY_DAYS,
];

/**
 * TimeWindow determines data available in TimePeriod
 * If TimeWindow is small, lower TimePeriod to limit data points
 */
const AVAILABLE_TIME_PERIODS: Record<TimeWindow, readonly TimePeriod[]> = {
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
    TimePeriod.THIRTY_DAYS,
  ],
  [TimeWindow.ONE_DAY]: [TimePeriod.THIRTY_DAYS],
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
  statsPeriod: TimePeriod;
  totalCount: number | null;
};

/**
 * This is a chart to be used in Metric Alert rules that fetches events based on
 * query, timewindow, and aggregations.
 */
class TriggersChart extends React.PureComponent<Props, State> {
  state: State = {
    statsPeriod: TimePeriod.SEVEN_DAYS,
    totalCount: null,
  };

  componentDidMount() {
    if (!isSessionAggregate(this.props.aggregate)) {
      this.fetchTotalCount();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {query, environment, timeWindow, aggregate, projects} = this.props;
    const {statsPeriod} = this.state;
    if (
      !isSessionAggregate(aggregate) &&
      (prevProps.projects !== projects ||
        prevProps.environment !== environment ||
        prevProps.query !== query ||
        prevProps.timeWindow !== timeWindow ||
        prevState.statsPeriod !== statsPeriod)
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

  handleStatsPeriodChange = (timePeriod: string) => {
    this.setState({statsPeriod: timePeriod as TimePeriod});
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
    const {api, organization, environment, projects, query} = this.props;
    const statsPeriod = this.getStatsPeriod();
    try {
      const totalCount = await fetchTotalCount(api, organization.slug, {
        field: [],
        project: projects.map(({id}) => id),
        query,
        statsPeriod,
        environment: environment ? [environment] : [],
      });
      this.setState({totalCount});
    } catch (e) {
      this.setState({totalCount: null});
    }
  }

  renderChart(
    timeseriesData: Series[] = [],
    isLoading: boolean,
    isReloading: boolean,
    comparisonData?: Series[],
    comparisonMarkLines?: LineChartSeries[],
    minutesThresholdToDisplaySeconds?: number
  ) {
    const {
      triggers,
      resolveThreshold,
      thresholdType,
      header,
      timeWindow,
      aggregate,
      comparisonType,
    } = this.props;
    const {statsPeriod, totalCount} = this.state;
    const statsPeriodOptions = this.availableTimePeriods[timeWindow];
    const period = this.getStatsPeriod();
    return (
      <React.Fragment>
        {header}
        <TransparentLoadingMask visible={isReloading} />
        {isLoading ? (
          <ChartPlaceholder />
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
          />
        )}
        <ChartControls>
          <InlineContainer>
            <SectionHeading>
              {isSessionAggregate(aggregate)
                ? SESSION_AGGREGATE_TO_HEADING[aggregate]
                : t('Total Events')}
            </SectionHeading>
            <SectionValue>
              {totalCount !== null ? totalCount.toLocaleString() : '\u2014'}
            </SectionValue>
          </InlineContainer>
          <InlineContainer>
            <OptionSelector
              options={statsPeriodOptions.map(timePeriod => ({
                label: TIME_PERIOD_MAP[timePeriod],
                value: timePeriod,
                disabled: isLoading || isReloading,
              }))}
              selected={period}
              onChange={this.handleStatsPeriodChange}
              title={t('Display')}
            />
          </InlineContainer>
        </ChartControls>
      </React.Fragment>
    );
  }

  render() {
    const {
      api,
      organization,
      projects,
      timeWindow,
      query,
      aggregate,
      environment,
      comparisonDelta,
      triggers,
      thresholdType,
    } = this.props;

    const period = this.getStatsPeriod();
    const renderComparisonStats = Boolean(
      organization.features.includes('change-alerts') && comparisonDelta
    );

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
        {({loading, reloading, response}) => {
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

          return this.renderChart(
            sessionTimeSeries,
            loading,
            reloading,
            undefined,
            undefined,
            MINUTES_THRESHOLD_TO_DISPLAY_SECONDS
          );
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
        currentSeriesNames={[aggregate]}
        partial={false}
      >
        {({loading, reloading, timeseriesData, comparisonTimeseriesData}) => {
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

          return this.renderChart(
            timeseriesData,
            loading,
            reloading,
            comparisonTimeseriesData,
            comparisonMarkLines
          );
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
