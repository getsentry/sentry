import * as React from 'react';
import {withTheme} from '@emotion/react';
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
import {defined} from 'app/utils';
import {WebVital} from 'app/utils/discover/fields';
import {getExactDuration} from 'app/utils/formatters';
import {Theme} from 'app/utils/theme';
import {QueryResults} from 'app/utils/tokenizeSearch';

import {displayCrashFreePercent, roundDuration} from '../../utils';

import {EventType, YAxis} from './chart/releaseChartControls';
import {
  fillChartDataFromSessionsResponse,
  fillCrashFreeChartDataFromSessionsReponse,
  getInterval,
  getReleaseEventView,
  getTotalsFromSessionsResponse,
  initCrashFreeChartData,
  initOtherCrashFreeChartData,
  initOtherSessionDurationChartData,
  initOtherSessionsBreakdownChartData,
  initSessionDurationChartData,
  initSessionsBreakdownChartData,
} from './chart/utils';

const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_, key) =>
    ['api', 'orgId', 'projectSlug', 'location', 'children'].includes(key)
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
  theme: Theme;
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
    const {version, organization, location, selection, defaultStatsPeriod} = this.props;

    return {
      query: new QueryResults([`release:"${version}"`]).formatString(),
      interval: getInterval(selection.datetime, {
        highFidelity: organization.features.includes('minute-resolution-sessions'),
      }),
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
    } catch (error) {
      addErrorMessage(error.responseJSON?.detail ?? t('Error loading chart data'));
      this.setState({
        errored: true,
        data: null,
      });
    }

    if (!defined(data) && !this.state.errored) {
      // this should not happen
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
    const {api, version, theme} = this.props;

    const [releaseResponse, otherReleasesResponse]: SessionApiResponse[] =
      await Promise.all([
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
            query: new QueryResults([`!release:"${version}"`]).formatString(),
          },
        }),
      ]);

    const totalSessions = getTotalsFromSessionsResponse({
      response: releaseResponse,
      field: 'sum(session)',
    });

    const chartData = fillChartDataFromSessionsResponse({
      response: releaseResponse,
      field: 'sum(session)',
      groupBy: 'session.status',
      chartData: initSessionsBreakdownChartData(theme),
    });

    const otherChartData = fillChartDataFromSessionsResponse({
      response: otherReleasesResponse,
      field: 'sum(session)',
      groupBy: 'session.status',
      chartData: initOtherSessionsBreakdownChartData(theme),
    });

    return {
      chartData: [...Object.values(chartData), ...Object.values(otherChartData)],
      chartSummary: totalSessions.toLocaleString(),
    };
  }

  async fetchUsers() {
    const {api, version, theme} = this.props;

    const [releaseResponse, otherReleasesResponse]: SessionApiResponse[] =
      await Promise.all([
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
            query: new QueryResults([`!release:"${version}"`]).formatString(),
          },
        }),
      ]);

    const totalUsers = getTotalsFromSessionsResponse({
      response: releaseResponse,
      field: 'count_unique(user)',
    });

    const chartData = fillChartDataFromSessionsResponse({
      response: releaseResponse,
      field: 'count_unique(user)',
      groupBy: 'session.status',
      chartData: initSessionsBreakdownChartData(theme),
    });

    const otherChartData = fillChartDataFromSessionsResponse({
      response: otherReleasesResponse,
      field: 'count_unique(user)',
      groupBy: 'session.status',
      chartData: initOtherSessionsBreakdownChartData(theme),
    });

    return {
      chartData: [...Object.values(chartData), ...Object.values(otherChartData)],
      chartSummary: totalUsers.toLocaleString(),
    };
  }

  async fetchCrashFree() {
    const {api, version} = this.props;

    const [releaseResponse, otherReleasesResponse]: SessionApiResponse[] =
      await Promise.all([
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
            query: new QueryResults([`!release:"${version}"`]).formatString(),
          },
        }),
      ]);

    let chartData = fillCrashFreeChartDataFromSessionsReponse({
      response: releaseResponse,
      field: 'sum(session)',
      entity: 'sessions',
      chartData: initCrashFreeChartData(),
    });
    chartData = fillCrashFreeChartDataFromSessionsReponse({
      response: releaseResponse,
      field: 'count_unique(user)',
      entity: 'users',
      chartData,
    });

    let otherChartData = fillCrashFreeChartDataFromSessionsReponse({
      response: otherReleasesResponse,
      field: 'sum(session)',
      entity: 'sessions',
      chartData: initOtherCrashFreeChartData(),
    });
    otherChartData = fillCrashFreeChartDataFromSessionsReponse({
      response: otherReleasesResponse,
      field: 'count_unique(user)',
      entity: 'users',
      chartData: otherChartData,
    });

    // summary is averaging previously rounded values - this might lead to a slightly skewed percentage
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

    const [releaseResponse, otherReleasesResponse]: SessionApiResponse[] =
      await Promise.all([
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
            query: new QueryResults([`!release:"${version}"`]).formatString(),
          },
        }),
      ]);

    const totalMedianDuration = getTotalsFromSessionsResponse({
      response: releaseResponse,
      field: 'p50(session.duration)',
    });

    const chartData = fillChartDataFromSessionsResponse({
      response: releaseResponse,
      field: 'p50(session.duration)',
      groupBy: null,
      chartData: initSessionDurationChartData(),
      valueFormatter: duration => roundDuration(duration ? duration / 1000 : 0),
    });

    const otherChartData = fillChartDataFromSessionsResponse({
      response: otherReleasesResponse,
      field: 'p50(session.duration)',
      groupBy: null,
      chartData: initOtherSessionDurationChartData(),
      valueFormatter: duration => roundDuration(duration ? duration / 1000 : 0),
    });

    return {
      chartData: [...Object.values(chartData), ...Object.values(otherChartData)],
      chartSummary: getExactDuration(
        roundDuration(totalMedianDuration ? totalMedianDuration / 1000 : 0)
      ),
    };
  }

  async fetchEventData() {
    const {api, organization, location, yAxis, eventType, vitalType, selection, version} =
      this.props;
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

export default withTheme(ReleaseStatsRequest);
