import React from 'react';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {
  DateTimeObject,
  getDiffInMinutes,
  SIXTY_DAYS,
  THIRTY_DAYS,
} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import {GlobalSelection, Organization, SessionApiResponse} from 'app/types';
import {Series} from 'app/types/echarts';
import {percent} from 'app/utils';
import {getPeriod} from 'app/utils/getPeriod';
import {getCrashFreePercent} from 'app/views/releases/utils';

import {shouldFetchPreviousPeriod} from '../utils';

const omitIgnoredProps = (props: Props) =>
  omit(props, ['api', 'organization', 'children', 'selection.datetime.utc']);

function getInterval(datetimeObj: DateTimeObject) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes >= SIXTY_DAYS) {
    // Greater than or equal to 60 days
    return '1d';
  }

  if (diffInMinutes >= THIRTY_DAYS) {
    // Greater than or equal to 30 days
    return '4h';
  }

  return '1h';
}

type ReleaseStatsRequestRenderProps = {
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  timeseriesData: Series[];
  previousTimeseriesData: Series | null;
  totalSessions: number | null;
};

type Props = {
  api: Client;
  organization: Organization;
  selection: GlobalSelection;
  children: (renderProps: ReleaseStatsRequestRenderProps) => React.ReactNode;
};

type State = {
  reloading: boolean;
  errored: boolean;
  timeseriesData: Series[] | null;
  previousTimeseriesData: Series | null;
  totalSessions: number | null;
};

class SessionsRequest extends React.Component<Props, State> {
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
    const {api, selection} = this.props;
    const shouldFetchWithPrevious = shouldFetchPreviousPeriod(selection.datetime);

    this.setState(state => ({
      reloading: state.timeseriesData !== null,
      errored: false,
    }));

    try {
      const response: SessionApiResponse = await api.requestPromise(this.path, {
        query: this.queryParams({shouldFetchWithPrevious}),
      });

      const {
        timeseriesData,
        previousTimeseriesData,
        totalSessions,
      } = this.transformData(response, {fetchedWithPrevious: shouldFetchWithPrevious});

      if (this.unmounting) {
        return;
      }

      this.setState({
        reloading: false,
        timeseriesData,
        previousTimeseriesData,
        totalSessions,
      });
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

  queryParams({shouldFetchWithPrevious = false}) {
    const {selection} = this.props;
    const {datetime, projects, environments: environment} = selection;

    const baseParams = {
      field: 'sum(session)',
      groupBy: 'session.status',
      interval: getInterval(datetime),
      project: projects[0],
      environment,
    };

    if (!shouldFetchWithPrevious) {
      return {
        ...baseParams,
        ...getParams(datetime),
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
    {fetchedWithPrevious = false}
  ): {
    timeseriesData: Series[];
    previousTimeseriesData: Series | null;
    totalSessions: number;
  } {
    // Take the floor just in case, but data should always be divisible by 2
    const dataMiddleIndex = Math.floor(responseData.intervals.length / 2);

    // calculate the total number of sessions for this period (exclude previous if there)
    const totalSessions = responseData.groups.reduce(
      (acc, group) =>
        acc +
        group.series['sum(session)']
          .slice(fetchedWithPrevious ? dataMiddleIndex : 0)
          .reduce((value, groupAcc) => groupAcc + value, 0),
      0
    );

    // TODO(project-details): refactor this to avoid duplication as we add more session charts
    const timeseriesData = [
      {
        seriesName: t('This Period'),
        data: responseData.intervals
          .slice(fetchedWithPrevious ? dataMiddleIndex : 0)
          .map((interval, i) => {
            const totalIntervalSessions = responseData.groups.reduce(
              (acc, group) =>
                acc +
                group.series['sum(session)'].slice(
                  fetchedWithPrevious ? dataMiddleIndex : 0
                )[i],
              0
            );

            const intervalCrashedSessions =
              responseData.groups
                .find(group => group.by['session.status'] === 'crashed')
                ?.series['sum(session)'].slice(fetchedWithPrevious ? dataMiddleIndex : 0)[
                i
              ] ?? 0;

            const crashedSessionsPercent = percent(
              intervalCrashedSessions,
              totalIntervalSessions
            );

            return {
              name: interval,
              value: getCrashFreePercent(100 - crashedSessionsPercent),
            };
          }),
      },
    ];

    const previousTimeseriesData = fetchedWithPrevious
      ? {
          seriesName: t('Previous Period'),
          data: responseData.intervals.slice(0, dataMiddleIndex).map((_interval, i) => {
            const totalIntervalSessions = responseData.groups.reduce(
              (acc, group) =>
                acc + group.series['sum(session)'].slice(0, dataMiddleIndex)[i],
              0
            );

            const intervalCrashedSessions =
              responseData.groups
                .find(group => group.by['session.status'] === 'crashed')
                ?.series['sum(session)'].slice(0, dataMiddleIndex)[i] ?? 0;

            const crashedSessionsPercent = percent(
              intervalCrashedSessions,
              totalIntervalSessions
            );

            return {
              name: responseData.intervals[i + dataMiddleIndex],
              value: getCrashFreePercent(100 - crashedSessionsPercent),
            };
          }),
        }
      : null;

    return {
      totalSessions,
      timeseriesData,
      previousTimeseriesData,
    };
  }

  render() {
    const {children} = this.props;
    const {
      timeseriesData,
      reloading,
      errored,
      totalSessions,
      previousTimeseriesData,
    } = this.state;
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

export default SessionsRequest;
