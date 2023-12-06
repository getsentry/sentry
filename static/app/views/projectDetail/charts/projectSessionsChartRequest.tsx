import {Component} from 'react';
import {Theme, withTheme} from '@emotion/react';
import {LineSeriesOption} from 'echarts';
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
  SessionFieldWithOperation,
  SessionStatus,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {getPeriod} from 'sentry/utils/getPeriod';
import {
  filterSessionsInTimeWindow,
  getCount,
  getCountSeries,
  getSessionsInterval,
  initSessionsChart,
} from 'sentry/utils/sessions';
import {getCrashFreePercent} from 'sentry/views/releases/utils';

import {DisplayModes} from '../projectCharts';

const omitIgnoredProps = (props: ProjectSessionsChartRequestProps) =>
  omit(props, ['api', 'organization', 'children', 'selection.datetime.utc']);

type ProjectSessionsChartRequestRenderProps = {
  errored: boolean;
  loading: boolean;
  previousTimeseriesData: Series | null;
  reloading: boolean;
  timeseriesData: Series[];
  totalSessions: number | null;
  additionalSeries?: LineSeriesOption[];
};

export type ProjectSessionsChartRequestProps = {
  api: Client;
  children: (renderProps: ProjectSessionsChartRequestRenderProps) => React.ReactNode;
  displayMode:
    | DisplayModes.SESSIONS
    | DisplayModes.STABILITY
    | DisplayModes.STABILITY_USERS
    // ANR is handled by the ProjectSessionsAnrRequest component
    | DisplayModes.ANR_RATE
    | DisplayModes.FOREGROUND_ANR_RATE;
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

class ProjectSessionsChartRequest extends Component<
  ProjectSessionsChartRequestProps,
  State
> {
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

  componentDidUpdate(prevProps: ProjectSessionsChartRequestProps) {
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
      const requests = [
        api.requestPromise(this.path, {
          query: queryParams,
        }),
      ];
      // for crash free sessions and users, we need to make a separate request to get the total count in period
      if (this.isCrashFreeRate) {
        requests.push(
          api.requestPromise(this.path, {
            query: {
              ...queryParams,
              field:
                displayMode === DisplayModes.STABILITY_USERS
                  ? SessionFieldWithOperation.USERS
                  : SessionFieldWithOperation.SESSIONS,
              groupBy: undefined,
              ...(shouldFetchWithPrevious ? {statsPeriod: datetime.period} : {}),
            },
          })
        );
      }
      const [response, totalCountResponse]: SessionApiResponse[] =
        await Promise.all(requests);

      const filteredResponse = filterSessionsInTimeWindow(
        response,
        queryParams.start,
        queryParams.end
      );

      const {timeseriesData, previousTimeseriesData, totalCount} =
        displayMode === DisplayModes.SESSIONS
          ? this.transformSessionCountData(filteredResponse)
          : this.transformData(filteredResponse, totalCountResponse, {
              fetchedWithPrevious: shouldFetchWithPrevious,
            });

      if (this.unmounting) {
        return;
      }

      this.setState({
        reloading: false,
        timeseriesData,
        previousTimeseriesData,
        totalSessions: totalCount,
      });
      onTotalValuesChange(totalCount);
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
    switch (displayMode) {
      case DisplayModes.STABILITY_USERS:
        return SessionFieldWithOperation.CRASH_FREE_RATE_USERS;
      case DisplayModes.STABILITY:
        return SessionFieldWithOperation.CRASH_FREE_RATE_SESSIONS;
      default:
        return SessionFieldWithOperation.SESSIONS;
    }
  }

  get isCrashFreeRate() {
    return [DisplayModes.STABILITY, DisplayModes.STABILITY_USERS].includes(
      this.props.displayMode
    );
  }

  queryParams({shouldFetchWithPrevious = false}): Record<string, any> {
    const {selection, query, organization} = this.props;
    const {datetime, projects, environments: environment} = selection;

    const baseParams = {
      field: this.field,
      groupBy: this.isCrashFreeRate ? undefined : 'session.status',
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

  transformData(
    responseData: SessionApiResponse,
    totalCountResponse: SessionApiResponse,
    {fetchedWithPrevious = false}
  ) {
    const {theme} = this.props;
    const {field} = this;

    // Take the floor just in case, but data should always be divisible by 2
    const dataMiddleIndex = Math.floor(responseData.intervals.length / 2);

    // TODO(project-details): refactor this to avoid duplication as we add more session charts
    const timeseriesData = [
      {
        seriesName: t('This Period'),
        color: theme.green300,
        data: responseData.intervals
          .slice(fetchedWithPrevious ? dataMiddleIndex : 0)
          .map((interval, i) => {
            const crashedSessionsPercent =
              responseData.groups[0]?.series[field].slice(
                fetchedWithPrevious ? dataMiddleIndex : 0
              )[i] * 100 ?? 0;

            return {
              name: interval,
              value: getCrashFreePercent(crashedSessionsPercent),
            };
          }),
      },
    ] as Series[]; // TODO(project-detail): Change SeriesDataUnit value to support null

    const previousTimeseriesData = fetchedWithPrevious
      ? ({
          seriesName: t('Previous Period'),
          data: responseData.intervals.slice(0, dataMiddleIndex).map((_interval, i) => {
            const crashedSessionsPercent =
              responseData.groups[0]?.series[field].slice(0, dataMiddleIndex)[i] * 100 ??
              0;

            return {
              name: responseData.intervals[i + dataMiddleIndex],
              value: getCrashFreePercent(crashedSessionsPercent),
            };
          }),
        } as Series) // TODO(project-detail): Change SeriesDataUnit value to support null
      : null;

    const totalCount =
      totalCountResponse?.groups[0].totals[
        this.props.displayMode === DisplayModes.STABILITY_USERS
          ? SessionFieldWithOperation.USERS
          : SessionFieldWithOperation.SESSIONS
      ];

    return {
      timeseriesData,
      totalCount,
      previousTimeseriesData,
    };
  }

  transformSessionCountData(responseData: SessionApiResponse) {
    const {theme} = this.props;
    const sessionsChart = initSessionsChart(theme);
    const {intervals, groups} = responseData;

    const totalSessions = getCount(
      responseData.groups,
      SessionFieldWithOperation.SESSIONS
    );

    const chartData = [
      {
        ...sessionsChart[SessionStatus.HEALTHY],
        data: getCountSeries(
          SessionFieldWithOperation.SESSIONS,
          groups.find(g => g.by['session.status'] === SessionStatus.HEALTHY),
          intervals
        ),
      },
      {
        ...sessionsChart[SessionStatus.ERRORED],
        data: getCountSeries(
          SessionFieldWithOperation.SESSIONS,
          groups.find(g => g.by['session.status'] === SessionStatus.ERRORED),
          intervals
        ),
      },
      {
        ...sessionsChart[SessionStatus.ABNORMAL],
        data: getCountSeries(
          SessionFieldWithOperation.SESSIONS,
          groups.find(g => g.by['session.status'] === SessionStatus.ABNORMAL),
          intervals
        ),
      },
      {
        ...sessionsChart[SessionStatus.CRASHED],
        data: getCountSeries(
          SessionFieldWithOperation.SESSIONS,
          groups.find(g => g.by['session.status'] === SessionStatus.CRASHED),
          intervals
        ),
      },
    ];

    return {
      timeseriesData: chartData,
      previousTimeseriesData: null,
      totalCount: totalSessions,
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
