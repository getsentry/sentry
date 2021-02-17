import React from 'react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import meanBy from 'lodash/meanBy';
import omitBy from 'lodash/omitBy';
import pick from 'lodash/pick';

import {fetchTotalCount} from 'app/actionCreators/events';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t, tct} from 'app/locale';
import {GlobalSelection, Organization, SessionApiResponse} from 'app/types';
import {Series} from 'app/types/echarts';
import {defined, percent} from 'app/utils';
import {WebVital} from 'app/utils/discover/fields';
import {getExactDuration} from 'app/utils/formatters';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';

import {displayCrashFreePercent, getCrashFreePercent, roundDuration} from '../../utils';

import {EventType, YAxis} from './chart/releaseChartControls';
import {
  getInterval,
  getReleaseEventView,
  initCrashFreeChartData,
  initOtherCrashFreeChartData,
  initOtherSessionDurationChartData,
  initOtherSessionsBreakdownChartData,
  initSessionDurationChartData,
  initSessionsBreakdownChartData,
} from './chart/utils';

const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_, key) =>
    ['api', 'version', 'orgId', 'projectSlug', 'location', 'children'].includes(key)
  );

type Data = {
  chartData: Series[];
  chartSummary: React.ReactNode;
};

export type ReleaseStatsRequestRenderProps = Data & {
  loading: boolean;
  reloading: boolean;
  errored: boolean;
};

type Props = {
  api: Client;
  version: string;
  organization: Organization;
  projectSlug: string;
  selection: GlobalSelection;
  location: Location;
  yAxis: YAxis;
  eventType: EventType;
  vitalType: WebVital;
  children: (renderProps: ReleaseStatsRequestRenderProps) => React.ReactNode;
  hasHealthData: boolean;
  hasDiscover: boolean;
  hasPerformance: boolean;
  defaultStatsPeriod: string;
};
type State = {
  reloading: boolean;
  errored: boolean;
  data: Data | null;
};

class ReleaseStatsRequest extends React.Component<Props, State> {
  state: State = {
    reloading: false,
    errored: false,
    data: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (isEqual(omitIgnoredProps(prevProps), omitIgnoredProps(this.props))) {
      return;
    }
    this.fetchData();
  }

  componentWillUnmount() {
    this.unmounting = true;
  }

  private unmounting: boolean = false;

  get path() {
    const {organization} = this.props;

    return `/organizations/${organization.slug}/sessions/`;
  }

  get baseQueryParams() {
    const {version, location, selection, defaultStatsPeriod} = this.props;

    return {
      query: stringifyQueryObject(new QueryResults([`release:${version}`])),
      interval: getInterval(selection.datetime),
      ...getParams(pick(location.query, Object.values(URL_PARAM)), {
        defaultStatsPeriod,
      }),
    };
  }

  fetchData = async () => {
    let data: Data | null = null;
    const {yAxis, hasHealthData, hasDiscover, hasPerformance} = this.props;

    if (!hasHealthData && !hasDiscover && !hasPerformance) {
      return;
    }

    this.setState(state => ({
      reloading: state.data !== null,
      errored: false,
    }));

    try {
      if (yAxis === YAxis.SESSIONS) {
        data = await this.fetchSessions();
      }

      if (yAxis === YAxis.USERS) {
        data = await this.fetchUsers();
      }

      if (yAxis === YAxis.CRASH_FREE) {
        data = await this.fetchCrashFree();
      }

      if (yAxis === YAxis.SESSION_DURATION) {
        data = await this.fetchSessionDuration();
      }

      if (
        yAxis === YAxis.EVENTS ||
        yAxis === YAxis.FAILED_TRANSACTIONS ||
        yAxis === YAxis.COUNT_DURATION ||
        yAxis === YAxis.COUNT_VITAL
      ) {
        // this is used to get total counts for chart footer summary
        data = await this.fetchEventData();
      }
    } catch {
      addErrorMessage(t('Error loading chart data'));
      this.setState({
        errored: true,
        data: null,
      });
    }

    if (this.unmounting) {
      return;
    }

    this.setState({
      reloading: false,
      data,
    });
  };

  async fetchSessions() {
    const {api, version} = this.props;

    const [
      releaseResponse,
      otherReleasesResponse,
    ]: SessionApiResponse[] = await Promise.all([
      api.requestPromise(this.path, {
        query: {
          ...this.baseQueryParams,
          field: 'sum(session)',
          groupBy: 'session.status',
        },
      }),
      api.requestPromise(this.path, {
        query: {
          ...this.baseQueryParams,
          field: 'sum(session)',
          groupBy: 'session.status',
          query: stringifyQueryObject(new QueryResults([`!release:${version}`])),
        },
      }),
    ]);

    const chartData = initSessionsBreakdownChartData();
    const otherChartData = initOtherSessionsBreakdownChartData();

    const totalSessions = releaseResponse.groups.reduce((acc, group) => {
      return acc + group.totals['sum(session)'];
    }, 0);

    releaseResponse.intervals.forEach((interval, index) => {
      releaseResponse.groups.forEach(group => {
        chartData[group.by['session.status']].data.push({
          name: interval,
          value: group.series['sum(session)'][index],
        });
      });
    });

    otherReleasesResponse.intervals.forEach((interval, index) => {
      otherReleasesResponse.groups.forEach(group => {
        otherChartData[group.by['session.status']].data.push({
          name: interval,
          value: group.series['sum(session)'][index],
        });
      });
    });

    return {
      chartData: [...Object.values(chartData), ...Object.values(otherChartData)],
      chartSummary: totalSessions.toLocaleString(),
    };
  }

  async fetchUsers() {
    const {api, version} = this.props;

    const [
      releaseResponse,
      otherReleasesResponse,
    ]: SessionApiResponse[] = await Promise.all([
      api.requestPromise(this.path, {
        query: {
          ...this.baseQueryParams,
          field: 'count_unique(user)',
          groupBy: 'session.status',
        },
      }),
      api.requestPromise(this.path, {
        query: {
          ...this.baseQueryParams,
          field: 'count_unique(user)',
          groupBy: 'session.status',
          query: stringifyQueryObject(new QueryResults([`!release:${version}`])),
        },
      }),
    ]);

    const chartData = initSessionsBreakdownChartData();
    const otherChartData = initOtherSessionsBreakdownChartData();

    const totalUsers = releaseResponse.groups.reduce((acc, group) => {
      return acc + group.totals['count_unique(user)'];
    }, 0);

    releaseResponse.intervals.forEach((interval, index) => {
      releaseResponse.groups.forEach(group => {
        chartData[group.by['session.status']].data.push({
          name: interval,
          value: group.series['count_unique(user)'][index],
        });
      });
    });

    otherReleasesResponse.intervals.forEach((interval, index) => {
      otherReleasesResponse.groups.forEach(group => {
        otherChartData[group.by['session.status']].data.push({
          name: interval,
          value: group.series['count_unique(user)'][index],
        });
      });
    });

    return {
      chartData: [...Object.values(chartData), ...Object.values(otherChartData)],
      chartSummary: totalUsers.toLocaleString(),
    };
  }

  async fetchCrashFree() {
    const {api, version} = this.props;

    const [
      releaseResponse,
      otherReleasesResponse,
    ]: SessionApiResponse[] = await Promise.all([
      api.requestPromise(this.path, {
        query: {
          ...this.baseQueryParams,
          field: ['sum(session)', 'count_unique(user)'],
          groupBy: 'session.status',
        },
      }),
      api.requestPromise(this.path, {
        query: {
          ...this.baseQueryParams,
          field: ['sum(session)', 'count_unique(user)'],
          groupBy: 'session.status',
          query: stringifyQueryObject(new QueryResults([`!release:${version}`])),
        },
      }),
    ]);

    const chartData = initCrashFreeChartData();
    const otherChartData = initOtherCrashFreeChartData();

    releaseResponse.intervals.forEach((interval, index) => {
      const intervalTotalSessions = releaseResponse.groups.reduce(
        (acc, group) => acc + group.series['sum(session)'][index],
        0
      );

      const intervalCrashedSessions =
        releaseResponse.groups.find(group => group.by['session.status'] === 'crashed')
          ?.series['sum(session)'][index] ?? 0;

      const crashedSessionsPercent = percent(
        intervalCrashedSessions,
        intervalTotalSessions
      );

      chartData.sessions.data.push({
        name: interval,
        // TODO: if total sessions = 0
        value:
          intervalTotalSessions === 0
            ? (null as any)
            : getCrashFreePercent(100 - crashedSessionsPercent),
      });
    });

    releaseResponse.intervals.forEach((interval, index) => {
      const intervalTotalUsers = releaseResponse.groups.reduce(
        (acc, group) => acc + group.series['count_unique(user)'][index],
        0
      );

      const intervalCrashedUsers =
        releaseResponse.groups.find(group => group.by['session.status'] === 'crashed')
          ?.series['count_unique(user)'][index] ?? 0;

      const crashedUsersPercent = percent(intervalCrashedUsers, intervalTotalUsers);

      chartData.users.data.push({
        name: interval,
        // TODO: if total sessions = 0
        value:
          intervalTotalUsers === 0
            ? (null as any)
            : getCrashFreePercent(100 - crashedUsersPercent),
      });
    });

    //
    otherReleasesResponse.intervals.forEach((interval, index) => {
      const intervalTotalSessions = otherReleasesResponse.groups.reduce(
        (acc, group) => acc + group.series['sum(session)'][index],
        0
      );

      const intervalCrashedSessions =
        otherReleasesResponse.groups.find(
          group => group.by['session.status'] === 'crashed'
        )?.series['sum(session)'][index] ?? 0;

      const crashedSessionsPercent = percent(
        intervalCrashedSessions,
        intervalTotalSessions
      );

      otherChartData.sessions.data.push({
        name: interval,
        // TODO: if total sessions = 0
        value:
          intervalTotalSessions === 0
            ? (null as any)
            : getCrashFreePercent(100 - crashedSessionsPercent),
      });
    });

    otherReleasesResponse.intervals.forEach((interval, index) => {
      const intervalTotalUsers = otherReleasesResponse.groups.reduce(
        (acc, group) => acc + group.series['count_unique(user)'][index],
        0
      );

      const intervalCrashedUsers =
        otherReleasesResponse.groups.find(
          group => group.by['session.status'] === 'crashed'
        )?.series['count_unique(user)'][index] ?? 0;

      const crashedUsersPercent = percent(intervalCrashedUsers, intervalTotalUsers);

      otherChartData.users.data.push({
        name: interval,
        // TODO: if total sessions = 0
        value:
          intervalTotalUsers === 0
            ? (null as any)
            : getCrashFreePercent(100 - crashedUsersPercent),
      });
    });

    // TODO(XXX): summary is averaging previously rounded values - this might lead to a slightly skewed percentage
    const summary = tct('[usersPercent] users, [sessionsPercent] sessions', {
      usersPercent: displayCrashFreePercent(
        meanBy(
          chartData.users.data.filter(item => defined(item.value)),
          'value'
        )
      ),
      sessionsPercent: displayCrashFreePercent(
        meanBy(
          chartData.sessions.data.filter(item => defined(item.value)),
          'value'
        )
      ),
    });

    return {
      chartData: [...Object.values(chartData), ...Object.values(otherChartData)],
      chartSummary: summary,
    };
  }

  async fetchSessionDuration() {
    const {api, version} = this.props;

    const [
      releaseResponse,
      otherReleasesResponse,
    ]: SessionApiResponse[] = await Promise.all([
      api.requestPromise(this.path, {
        query: {
          ...this.baseQueryParams,
          field: 'p50(session.duration)',
        },
      }),
      api.requestPromise(this.path, {
        query: {
          ...this.baseQueryParams,
          field: 'p50(session.duration)',
          query: stringifyQueryObject(new QueryResults([`!release:${version}`])),
        },
      }),
    ]);

    const chartData = initSessionDurationChartData();
    const otherChartData = initOtherSessionDurationChartData();

    const totalMedianDuration = releaseResponse.groups[0].totals['p50(session.duration)'];

    releaseResponse.intervals.forEach((interval, index) => {
      const duration = releaseResponse.groups[0].series['p50(session.duration)'][index];
      chartData.duration.data.push({
        name: interval,
        value: roundDuration(duration ? duration / 1000 : 0),
      });
    });

    otherReleasesResponse.intervals.forEach((interval, index) => {
      const duration =
        otherReleasesResponse.groups[0].series['p50(session.duration)'][index];
      otherChartData.duration.data.push({
        name: interval,
        value: roundDuration(duration ? duration / 1000 : 0),
      });
    });

    return {
      chartData: [...Object.values(chartData), ...Object.values(otherChartData)],
      chartSummary: getExactDuration(
        roundDuration(totalMedianDuration ? totalMedianDuration / 1000 : 0)
      ),
    };
  }

  async fetchEventData() {
    const {
      api,
      organization,
      location,
      yAxis,
      eventType,
      vitalType,
      selection,
      version,
    } = this.props;
    const eventView = getReleaseEventView(
      selection,
      version,
      yAxis,
      eventType,
      vitalType,
      organization,
      true
    );
    const payload = eventView.getEventsAPIPayload(location);
    const eventsCountResponse = await fetchTotalCount(api, organization.slug, payload);
    const chartSummary = eventsCountResponse.toLocaleString();

    return {chartData: [], chartSummary};
  }

  render() {
    const {children} = this.props;
    const {data, reloading, errored} = this.state;
    const loading = data === null;

    return children({
      loading,
      reloading,
      errored,
      chartData: data?.chartData ?? [],
      chartSummary: data?.chartSummary ?? '',
    });
  }
}

export default ReleaseStatsRequest;
