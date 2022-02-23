import * as React from 'react';
import {withTheme} from '@emotion/react';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import {
  Organization,
  PageFilters,
  SessionApiResponse,
  SessionField,
  SessionStatus,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {percent} from 'sentry/utils';
import {getPeriod} from 'sentry/utils/getPeriod';
import {
  filterSessionsInTimeWindow,
  getCount,
  getCountSeries,
  getSessionsInterval,
  initSessionsChart,
} from 'sentry/utils/sessions';
import {Theme} from 'sentry/utils/theme';
import {getCrashFreePercent} from 'sentry/views/releases/utils';

import {DisplayModes} from '../projectCharts';

const omitIgnoredProps = (props: Props) =>
  omit(props, ['api', 'organization', 'children', 'selection.datetime.utc']);

type ProjectSessionsChartRequestRenderProps = {
  errored: boolean;
  loading: boolean;
  previousTimeseriesData: Series | null;
  reloading: boolean;
  timeseriesData: Series[];
  totalSessions: number | null;
};

type Props = {
  api: Client;
  children: (renderProps: ProjectSessionsChartRequestRenderProps) => React.ReactNode;
  displayMode:
    | DisplayModes.SESSIONS
    | DisplayModes.STABILITY
    | DisplayModes.STABILITY_USERS;
  onTotalValuesChange: (value: number | null) => void;
  organization: Organization;
  selection: PageFilters;
  theme: Theme;
  disablePrevious?: boolean;
  query?: string;
};

type State = {
  errored: boolean;
  previousTimeseriesData: Series | null;
  reloading: boolean;
  timeseriesData: Series[] | null;
  totalSessions: number | null;
};

class ProjectSessionsChartRequest extends React.Component<Props, State> {
  state: State = {
    reloading: false,
    errored: false,
    timeseriesData: null,
    previousTimeseriesData: null,
    totalSessions: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (!isEqual(omitIgnoredProps(this.props), omitIgnoredProps(prevProps))) {
      this.fetchData();
    }
  }

  componentWillUnmount() {
    this.unmounting = true;
  }

  private unmounting: boolean = false;

  fetchData = async () => {
    const {
      api,
      selection: {datetime},
      onTotalValuesChange,
      displayMode,
      disablePrevious,
    } = this.props;
    const shouldFetchWithPrevious =
      !disablePrevious &&
      shouldFetchPreviousPeriod({
        start: datetime.start,
        end: datetime.end,
        period: datetime.period,
      });

    this.setState(state => ({
      reloading: state.timeseriesData !== null,
      errored: false,
    }));

    try {
      const queryParams = this.queryParams({shouldFetchWithPrevious});
      const response: SessionApiResponse = await api.requestPromise(this.path, {
        query: queryParams,
      });

      const filteredResponse = filterSessionsInTimeWindow(
        response,
        queryParams.start,
        queryParams.end
      );

      const {timeseriesData, previousTimeseriesData, totalSessions} =
        displayMode === DisplayModes.SESSIONS
          ? this.transformSessionCountData(filteredResponse)
          : this.transformData(filteredResponse, {
              fetchedWithPrevious: shouldFetchWithPrevious,
            });

      if (this.unmounting) {
        return;
      }

      this.setState({
        reloading: false,
        timeseriesData,
        previousTimeseriesData,
        totalSessions,
      });
      onTotalValuesChange(totalSessions);
    } catch {
      addErrorMessage(t('Error loading chart data'));
      this.setState({
        errored: true,
        reloading: false,
        timeseriesData: null,
        previousTimeseriesData: null,
        totalSessions: null,
      });
    }
  };

  get path() {
    const {organization} = this.props;

    return `/organizations/${organization.slug}/sessions/`;
  }

  get field() {
    const {displayMode} = this.props;
    return displayMode === DisplayModes.STABILITY_USERS
      ? SessionField.USERS
      : SessionField.SESSIONS;
  }

  queryParams({shouldFetchWithPrevious = false}): Record<string, any> {
    const {selection, query, organization} = this.props;
    const {datetime, projects, environments: environment} = selection;

    const baseParams = {
      field: this.field,
      groupBy: 'session.status',
      interval: getSessionsInterval(datetime, {
        highFidelity: organization.features.includes('minute-resolution-sessions'),
      }),
      project: projects[0],
      environment,
      query,
    };

    if (!shouldFetchWithPrevious) {
      return {
        ...baseParams,
        ...normalizeDateTimeParams(datetime),
      };
    }

    const {period} = selection.datetime;
    const doubledPeriod = getPeriod(
      {period, start: undefined, end: undefined},
      {shouldDoublePeriod: true}
    ).statsPeriod;

    return {
      ...baseParams,
      statsPeriod: doubledPeriod,
    };
  }

  transformData(responseData: SessionApiResponse, {fetchedWithPrevious = false}) {
    const {theme} = this.props;
    const {field} = this;

    // Take the floor just in case, but data should always be divisible by 2
    const dataMiddleIndex = Math.floor(responseData.intervals.length / 2);

    // calculate the total number of sessions for this period (exclude previous if there)
    const totalSessions = responseData.groups.reduce(
      (acc, group) =>
        acc +
        group.series[field]
          .slice(fetchedWithPrevious ? dataMiddleIndex : 0)
          .reduce((value, groupAcc) => groupAcc + value, 0),
      0
    );

    const previousPeriodTotalSessions = fetchedWithPrevious
      ? responseData.groups.reduce(
          (acc, group) =>
            acc +
            group.series[field]
              .slice(0, dataMiddleIndex)
              .reduce((value, groupAcc) => groupAcc + value, 0),
          0
        )
      : 0;

    // TODO(project-details): refactor this to avoid duplication as we add more session charts
    const timeseriesData = [
      {
        seriesName: t('This Period'),
        color: theme.green300,
        data: responseData.intervals
          .slice(fetchedWithPrevious ? dataMiddleIndex : 0)
          .map((interval, i) => {
            const totalIntervalSessions = responseData.groups.reduce(
              (acc, group) =>
                acc +
                group.series[field].slice(fetchedWithPrevious ? dataMiddleIndex : 0)[i],
              0
            );

            const intervalCrashedSessions =
              responseData.groups
                .find(group => group.by['session.status'] === 'crashed')
                ?.series[field].slice(fetchedWithPrevious ? dataMiddleIndex : 0)[i] ?? 0;

            const crashedSessionsPercent = percent(
              intervalCrashedSessions,
              totalIntervalSessions
            );

            return {
              name: interval,
              value:
                totalSessions === 0 && previousPeriodTotalSessions === 0
                  ? 0
                  : totalIntervalSessions === 0
                  ? null
                  : getCrashFreePercent(100 - crashedSessionsPercent),
            };
          }),
      },
    ] as Series[]; // TODO(project-detail): Change SeriesDataUnit value to support null

    const previousTimeseriesData = fetchedWithPrevious
      ? ({
          seriesName: t('Previous Period'),
          data: responseData.intervals.slice(0, dataMiddleIndex).map((_interval, i) => {
            const totalIntervalSessions = responseData.groups.reduce(
              (acc, group) => acc + group.series[field].slice(0, dataMiddleIndex)[i],
              0
            );

            const intervalCrashedSessions =
              responseData.groups
                .find(group => group.by['session.status'] === 'crashed')
                ?.series[field].slice(0, dataMiddleIndex)[i] ?? 0;

            const crashedSessionsPercent = percent(
              intervalCrashedSessions,
              totalIntervalSessions
            );

            return {
              name: responseData.intervals[i + dataMiddleIndex],
              value:
                totalSessions === 0 && previousPeriodTotalSessions === 0
                  ? 0
                  : totalIntervalSessions === 0
                  ? null
                  : getCrashFreePercent(100 - crashedSessionsPercent),
            };
          }),
        } as Series) // TODO(project-detail): Change SeriesDataUnit value to support null
      : null;

    return {
      totalSessions,
      timeseriesData,
      previousTimeseriesData,
    };
  }

  transformSessionCountData(responseData: SessionApiResponse) {
    const {theme} = this.props;
    const sessionsChart = initSessionsChart(theme);
    const {intervals, groups} = responseData;

    const totalSessions = getCount(responseData.groups, SessionField.SESSIONS);

    const chartData = [
      {
        ...sessionsChart[SessionStatus.HEALTHY],
        data: getCountSeries(
          SessionField.SESSIONS,
          groups.find(g => g.by['session.status'] === SessionStatus.HEALTHY),
          intervals
        ),
      },
      {
        ...sessionsChart[SessionStatus.ERRORED],
        data: getCountSeries(
          SessionField.SESSIONS,
          groups.find(g => g.by['session.status'] === SessionStatus.ERRORED),
          intervals
        ),
      },
      {
        ...sessionsChart[SessionStatus.ABNORMAL],
        data: getCountSeries(
          SessionField.SESSIONS,
          groups.find(g => g.by['session.status'] === SessionStatus.ABNORMAL),
          intervals
        ),
      },
      {
        ...sessionsChart[SessionStatus.CRASHED],
        data: getCountSeries(
          SessionField.SESSIONS,
          groups.find(g => g.by['session.status'] === SessionStatus.CRASHED),
          intervals
        ),
      },
    ];

    return {
      timeseriesData: chartData,
      previousTimeseriesData: null,
      totalSessions,
    };
  }

  render() {
    const {children} = this.props;
    const {timeseriesData, reloading, errored, totalSessions, previousTimeseriesData} =
      this.state;
    const loading = timeseriesData === null;

    return children({
      loading,
      reloading,
      errored,
      totalSessions,
      previousTimeseriesData,
      timeseriesData: timeseriesData ?? [],
    });
  }
}

export default withTheme(ProjectSessionsChartRequest);
