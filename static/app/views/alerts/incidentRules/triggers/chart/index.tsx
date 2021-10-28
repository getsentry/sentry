import * as React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';
import chunk from 'lodash/chunk';
import maxBy from 'lodash/maxBy';
import minBy from 'lodash/minBy';

import {fetchTotalCount} from 'app/actionCreators/events';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import EventsRequest from 'app/components/charts/eventsRequest';
import {LineChartSeries} from 'app/components/charts/lineChart';
import OptionSelector from 'app/components/charts/optionSelector';
import SessionsRequest from 'app/components/charts/sessionsRequest';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import LoadingMask from 'app/components/loadingMask';
import Placeholder from 'app/components/placeholder';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Series, SeriesDataUnit} from 'app/types/echarts';
import {
  getCrashFreeRateSeries,
  MINUTES_THRESHOLD_TO_DISPLAY_SECONDS,
} from 'app/utils/sessions';
import withApi from 'app/utils/withApi';
import {getComparisonMarkLines} from 'app/views/alerts/changeAlerts/comparisonMarklines';
import {COMPARISON_DELTA_OPTIONS} from 'app/views/alerts/incidentRules/constants';
import {isSessionAggregate, SESSION_AGGREGATE_TO_FIELD} from 'app/views/alerts/utils';
import {AlertWizardAlertNames} from 'app/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'app/views/alerts/wizard/utils';

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
  api: Client;
  organization: Organization;
  projects: Project[];

  query: IncidentRule['query'];
  timeWindow: IncidentRule['timeWindow'];
  environment: string | null;
  aggregate: IncidentRule['aggregate'];
  triggers: Trigger[];
  resolveThreshold: IncidentRule['resolveThreshold'];
  thresholdType: IncidentRule['thresholdType'];
  comparisonType: AlertRuleComparisonType;
  header?: React.ReactNode;
  comparisonDelta?: number;
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
 * If TimeWindow is small we want to limit the stats period
 * If the time window is one day we want to use a larger stats period
 */
const AVAILABLE_TIME_PERIODS: Record<TimeWindow, TimePeriod[]> = {
  [TimeWindow.ONE_MINUTE]: [
    TimePeriod.SIX_HOURS,
    TimePeriod.ONE_DAY,
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
  ],
  [TimeWindow.FIVE_MINUTES]: [
    TimePeriod.ONE_DAY,
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
    TimePeriod.THIRTY_DAYS,
  ],
  [TimeWindow.TEN_MINUTES]: [
    TimePeriod.ONE_DAY,
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
    TimePeriod.THIRTY_DAYS,
  ],
  [TimeWindow.FIFTEEN_MINUTES]: [
    TimePeriod.THREE_DAYS,
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
    TimePeriod.THIRTY_DAYS,
  ],
  [TimeWindow.THIRTY_MINUTES]: [
    TimePeriod.SEVEN_DAYS,
    TimePeriod.FOURTEEN_DAYS,
    TimePeriod.THIRTY_DAYS,
  ],
  [TimeWindow.ONE_HOUR]: [TimePeriod.FOURTEEN_DAYS, TimePeriod.THIRTY_DAYS],
  [TimeWindow.TWO_HOURS]: [TimePeriod.THIRTY_DAYS],
  [TimeWindow.FOUR_HOURS]: [TimePeriod.THIRTY_DAYS],
  [TimeWindow.ONE_DAY]: [TimePeriod.THIRTY_DAYS],
};

const AGGREGATE_FUNCTIONS = {
  avg: (seriesChunk: SeriesDataUnit[]) =>
    AGGREGATE_FUNCTIONS.sum(seriesChunk) / seriesChunk.length,
  sum: (seriesChunk: SeriesDataUnit[]) =>
    seriesChunk.reduce((acc, series) => acc + series.value, 0),
  max: (seriesChunk: SeriesDataUnit[]) =>
    Math.max(...seriesChunk.map(series => series.value)),
  min: (seriesChunk: SeriesDataUnit[]) =>
    Math.min(...seriesChunk.map(series => series.value)),
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

/**
 * Determines the number of datapoints to roll up
 */
const getBucketSize = (timeWindow: TimeWindow, dataPoints: number): number => {
  const MAX_DPS = 720;
  for (const bucketSize of [5, 10, 15, 30, 60, 120, 240]) {
    const chunkSize = bucketSize / timeWindow;
    if (dataPoints / chunkSize <= MAX_DPS) {
      return bucketSize / timeWindow;
    }
  }

  return 2;
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
    statsPeriod: TimePeriod.ONE_DAY,
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
      : statsPeriodOptions[0];
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
      <Feature features={['metric-alert-builder-aggregate']} organization={organization}>
        {({hasFeature}) => {
          return (
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

                let timeseriesLength: number | undefined;
                if (timeseriesData?.[0]?.data !== undefined) {
                  timeseriesLength = timeseriesData[0].data.length;
                  if (hasFeature && timeseriesLength > 600) {
                    const avgData: SeriesDataUnit[] = [];
                    const minData: SeriesDataUnit[] = [];
                    const maxData: SeriesDataUnit[] = [];
                    const chunkSize = getBucketSize(
                      timeWindow,
                      timeseriesData[0].data.length
                    );
                    chunk(timeseriesData[0].data, chunkSize).forEach(seriesChunk => {
                      avgData.push({
                        name: seriesChunk[0].name,
                        value: AGGREGATE_FUNCTIONS.avg(seriesChunk),
                      });
                      minData.push({
                        name: seriesChunk[0].name,
                        value: AGGREGATE_FUNCTIONS.min(seriesChunk),
                      });
                      maxData.push({
                        name: seriesChunk[0].name,
                        value: AGGREGATE_FUNCTIONS.max(seriesChunk),
                      });
                    });
                    timeseriesData = [
                      timeseriesData[0],
                      {seriesName: t('Minimum'), data: minData},
                      {seriesName: t('Average'), data: avgData},
                      {seriesName: t('Maximum'), data: maxData},
                    ];
                  }
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
        }}
      </Feature>
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
