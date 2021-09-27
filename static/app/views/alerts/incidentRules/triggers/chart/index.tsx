import * as React from 'react';
import styled from '@emotion/styled';
import chunk from 'lodash/chunk';
import maxBy from 'lodash/maxBy';

import {fetchTotalCount} from 'app/actionCreators/events';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import EventsRequest from 'app/components/charts/eventsRequest';
import OptionSelector from 'app/components/charts/optionSelector';
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
import {Organization, Project, SessionApiResponse, SessionField} from 'app/types';
import {Series, SeriesDataUnit} from 'app/types/echarts';
import {getCount, getCrashFreeRateSeries} from 'app/utils/sessions';
import withApi from 'app/utils/withApi';
import {isSessionAggregate} from 'app/views/alerts/utils';
import {AlertWizardAlertNames} from 'app/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'app/views/alerts/wizard/utils';

import {
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

const SESSION_AGGREGATE_TO_FIELD = {
  [SessionsAggregate.CRASH_FREE_SESSIONS]: SessionField.SESSIONS,
  [SessionsAggregate.CRASH_FREE_USERS]: SessionField.USERS,
};

const TIME_WINDOW_TO_SESSION_INTERVAL = {
  [TimeWindow.ONE_HOUR]: '1h',
  [TimeWindow.TWO_HOURS]: '2h',
  [TimeWindow.FOUR_HOURS]: '4h',
  [TimeWindow.ONE_DAY]: '1d',
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
  sessionTimeSeries: Series[] | null;
  sessionsLoading: boolean;
  sessionsReloading: boolean;
};

/**
 * This is a chart to be used in Metric Alert rules that fetches events based on
 * query, timewindow, and aggregations.
 */
class TriggersChart extends React.PureComponent<Props, State> {
  state: State = {
    statsPeriod: TimePeriod.ONE_DAY,
    totalCount: null,
    sessionTimeSeries: null,
    sessionsLoading: false,
    sessionsReloading: false,
  };

  componentDidMount() {
    if (isSessionAggregate(this.props.aggregate)) {
      this.fetchSessionTimeSeries();
      return;
    }

    this.fetchTotalCount();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    const {query, environment, timeWindow, aggregate} = this.props;
    const {statsPeriod} = this.state;
    if (
      prevProps.environment !== environment ||
      prevProps.query !== query ||
      prevProps.timeWindow !== timeWindow ||
      prevState.statsPeriod !== statsPeriod
    ) {
      if (isSessionAggregate(aggregate)) {
        this.fetchSessionTimeSeries();
        return;
      }

      this.fetchTotalCount();
    }
  }

  handleStatsPeriodChange = (timePeriod: string) => {
    this.setState({statsPeriod: timePeriod as TimePeriod});
  };

  getStatsPeriod = () => {
    const {statsPeriod} = this.state;
    const {timeWindow} = this.props;
    const statsPeriodOptions = AVAILABLE_TIME_PERIODS[timeWindow];
    const period = statsPeriodOptions.includes(statsPeriod)
      ? statsPeriod
      : statsPeriodOptions[0];
    return period;
  };

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

  async fetchSessionTimeSeries() {
    const {api, organization, environment, projects, query, timeWindow, aggregate} =
      this.props;
    try {
      this.setState(state => ({
        sessionsLoading: state.sessionTimeSeries === null,
        sessionsReloading: state.sessionTimeSeries !== null,
      }));
      const {groups, intervals}: SessionApiResponse = await api.requestPromise(
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            project: projects.map(({id}) => id),
            environment: environment ? [environment] : [],
            statsPeriod: this.getStatsPeriod(),
            field: SESSION_AGGREGATE_TO_FIELD[aggregate],
            interval: TIME_WINDOW_TO_SESSION_INTERVAL[timeWindow],
            groupBy: ['session.status'],
            query,
          },
        }
      );
      const totalCount = getCount(groups, SESSION_AGGREGATE_TO_FIELD[aggregate]);
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
      this.setState({
        sessionTimeSeries,
        totalCount,
        sessionsLoading: false,
        sessionsReloading: false,
      });
    } catch (e) {
      this.setState({
        sessionTimeSeries: null,
        totalCount: null,
        sessionsLoading: false,
        sessionsReloading: false,
      });
    }
  }

  renderChart(
    data: Series[] = [],
    isLoading: boolean,
    isReloading: boolean,
    maxValue?: number
  ) {
    const {triggers, resolveThreshold, thresholdType, header, timeWindow, aggregate} =
      this.props;
    const {statsPeriod, totalCount} = this.state;
    const statsPeriodOptions = AVAILABLE_TIME_PERIODS[timeWindow];
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
            maxValue={maxValue}
            data={data}
            triggers={triggers}
            resolveThreshold={resolveThreshold}
            thresholdType={thresholdType}
            aggregate={aggregate}
          />
        )}
        <ChartControls>
          <InlineContainer>
            <SectionHeading>
              {isSessionAggregate(aggregate) ? t('Total Sessions') : t('Total Events')}
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
    const {api, organization, projects, timeWindow, query, aggregate, environment} =
      this.props;
    const {sessionTimeSeries, sessionsLoading, sessionsReloading} = this.state;

    const period = this.getStatsPeriod();

    return isSessionAggregate(aggregate) ? (
      this.renderChart(
        sessionTimeSeries ?? undefined,
        sessionsLoading,
        sessionsReloading,
        100
      )
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
              period={period}
              yAxis={aggregate}
              includePrevious={false}
              currentSeriesName={aggregate}
              partial={false}
            >
              {({loading, reloading, timeseriesData}) => {
                let maxValue: SeriesDataUnit | undefined;
                let timeseriesLength: number | undefined;
                if (timeseriesData?.[0]?.data !== undefined) {
                  maxValue = maxBy(timeseriesData[0].data, ({value}) => value);
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
                  maxValue?.value
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
