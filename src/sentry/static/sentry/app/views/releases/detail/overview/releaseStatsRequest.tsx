import React from 'react';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';
import mean from 'lodash/mean';
import meanBy from 'lodash/meanBy';
import omitBy from 'lodash/omitBy';
import pick from 'lodash/pick';

import {fetchTotalCount} from 'app/actionCreators/events';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import CHART_PALETTE from 'app/constants/chartPalette';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t, tct} from 'app/locale';
import {CrashFreeTimeBreakdown, GlobalSelection, Organization} from 'app/types';
import {Series} from 'app/types/echarts';
import {defined, percent} from 'app/utils';
import {WebVital} from 'app/utils/discover/fields';
import {getExactDuration} from 'app/utils/formatters';

import {displayCrashFreePercent, getCrashFreePercent, roundDuration} from '../../utils';
import {sessionTerm} from '../../utils/sessionTerm';

import {EventType, YAxis} from './chart/releaseChartControls';
import {getInterval, getReleaseEventView} from './chart/utils';

const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_, key) =>
    ['api', 'version', 'orgId', 'projectSlug', 'location', 'children'].includes(key)
  );

type ChartData = Record<string, Series>;

type Data = {
  chartData: Series[];
  chartSummary: React.ReactNode;
  crashFreeTimeBreakdown: CrashFreeTimeBreakdown;
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
      if (yAxis === YAxis.CRASH_FREE) {
        data = await this.fetchRateData();
      } else if (
        yAxis === YAxis.EVENTS ||
        yAxis === YAxis.FAILED_TRANSACTIONS ||
        yAxis === YAxis.COUNT_DURATION ||
        yAxis === YAxis.COUNT_VITAL
      ) {
        data = await this.fetchEventData();
      } else {
        // session duration uses same endpoint as sessions
        data = await this.fetchCountData(
          yAxis === YAxis.SESSION_DURATION ? YAxis.SESSIONS : yAxis
        );
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

  fetchCountData = async (type: YAxis) => {
    const {api, yAxis} = this.props;

    const response = await api.requestPromise(this.statsPath, {
      query: {
        ...this.baseQueryParams,
        type,
      },
    });

    const transformedData =
      yAxis === YAxis.SESSION_DURATION
        ? this.transformSessionDurationData(response.stats)
        : this.transformCountData(response.stats, yAxis, response.statTotals);

    return {...transformedData, crashFreeTimeBreakdown: response.usersBreakdown};
  };

  fetchRateData = async () => {
    const {api} = this.props;

    const [userResponse, sessionResponse] = await Promise.all([
      api.requestPromise(this.statsPath, {
        query: {
          ...this.baseQueryParams,
          type: YAxis.USERS,
        },
      }),
      api.requestPromise(this.statsPath, {
        query: {
          ...this.baseQueryParams,
          type: YAxis.SESSIONS,
        },
      }),
    ]);

    const transformedData = this.transformRateData(
      userResponse.stats,
      sessionResponse.stats
    );

    return {...transformedData, crashFreeTimeBreakdown: userResponse.usersBreakdown};
  };

  fetchEventData = async () => {
    const {
      api,
      organization,
      location,
      yAxis,
      eventType,
      vitalType,
      selection,
      version,
      hasHealthData,
    } = this.props;
    const {crashFreeTimeBreakdown} = this.state.data || {};
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
    let userResponse, eventsCountResponse;

    // we don't need to fetch crashFreeTimeBreakdown every time, because it does not change
    if (crashFreeTimeBreakdown || !hasHealthData) {
      eventsCountResponse = await fetchTotalCount(api, organization.slug, payload);
    } else {
      [userResponse, eventsCountResponse] = await Promise.all([
        api.requestPromise(this.statsPath, {
          query: {
            ...this.baseQueryParams,
            type: YAxis.USERS,
          },
        }),
        fetchTotalCount(api, organization.slug, payload),
      ]);
    }

    const breakdown = userResponse?.usersBreakdown ?? crashFreeTimeBreakdown;
    const chartSummary = eventsCountResponse.toLocaleString();

    return {chartData: [], crashFreeTimeBreakdown: breakdown, chartSummary};
  };

  get statsPath() {
    const {organization, projectSlug, version} = this.props;

    return `/projects/${organization.slug}/${projectSlug}/releases/${version}/stats/`;
  }

  get baseQueryParams() {
    const {location, selection, defaultStatsPeriod} = this.props;

    return {
      ...getParams(pick(location.query, [...Object.values(URL_PARAM)]), {
        defaultStatsPeriod,
      }),
      interval: getInterval(selection.datetime),
    };
  }

  transformCountData(
    responseData,
    yAxis: string,
    responseTotals
  ): Omit<Data, 'crashFreeTimeBreakdown'> {
    // here we can configure colors of the chart
    const chartData: ChartData = {
      crashed: {
        seriesName: sessionTerm.crashed,
        data: [],
        color: CHART_PALETTE[3][2],
        areaStyle: {
          color: CHART_PALETTE[3][2],
          opacity: 1,
        },
        lineStyle: {
          opacity: 0,
          width: 0.4,
        },
      },
      abnormal: {
        seriesName: sessionTerm.abnormal,
        data: [],
        color: CHART_PALETTE[3][1],
        areaStyle: {
          color: CHART_PALETTE[3][1],
          opacity: 1,
        },
        lineStyle: {
          opacity: 0,
          width: 0.4,
        },
      },
      errored: {
        seriesName: sessionTerm.errored,
        data: [],
        color: CHART_PALETTE[3][0],
        areaStyle: {
          color: CHART_PALETTE[3][0],
          opacity: 1,
        },
        lineStyle: {
          opacity: 0,
          width: 0.4,
        },
      },
      healthy: {
        seriesName: sessionTerm.healthy,
        data: [],
        color: CHART_PALETTE[3][3],
        areaStyle: {
          color: CHART_PALETTE[3][3],
          opacity: 1,
        },
        lineStyle: {
          opacity: 0,
          width: 0.4,
        },
      },
    };

    responseData.forEach(entry => {
      const [timeframe, values] = entry;
      const date = timeframe * 1000;
      const crashed = values[`${yAxis}_crashed`];
      const abnormal = values[`${yAxis}_abnormal`];
      const errored = values[`${yAxis}_errored`];
      const healthy = values[yAxis] - crashed - abnormal - errored;

      chartData.crashed.data.push({name: date, value: crashed});
      chartData.abnormal.data.push({name: date, value: abnormal});
      chartData.errored.data.push({name: date, value: errored});
      chartData.healthy.data.push({
        name: date,
        value: healthy >= 0 ? healthy : 0,
      });
    });

    return {
      chartData: Object.values(chartData),
      chartSummary: responseTotals[yAxis].toLocaleString(),
    };
  }

  transformRateData(
    responseUsersData,
    responseSessionsData
  ): Omit<Data, 'crashFreeTimeBreakdown'> {
    const chartData: ChartData = {
      users: {
        seriesName: sessionTerm['crash-free-users'],
        data: [],
        color: CHART_PALETTE[1][0],
      },
      sessions: {
        seriesName: sessionTerm['crash-free-sessions'],
        data: [],
        color: CHART_PALETTE[1][1],
      },
    };

    const calculateDatePercentage = (responseData, subject: YAxis) => {
      const percentageData = responseData.map(entry => {
        const [timeframe, values] = entry;
        const date = timeframe * 1000;

        const crashFreePercent =
          values[subject] !== 0
            ? getCrashFreePercent(
                100 - percent(values[`${subject}_crashed`], values[subject])
              )
            : null;

        return {name: date, value: crashFreePercent};
      });

      const averagePercent = displayCrashFreePercent(
        meanBy(
          percentageData.filter(item => defined(item.value)),
          'value'
        )
      );

      return {averagePercent, percentageData};
    };

    const usersPercentages = calculateDatePercentage(responseUsersData, YAxis.USERS);
    chartData.users.data = usersPercentages.percentageData;

    const sessionsPercentages = calculateDatePercentage(
      responseSessionsData,
      YAxis.SESSIONS
    );
    chartData.sessions.data = sessionsPercentages.percentageData;

    const summary = tct('[usersPercent] users, [sessionsPercent] sessions', {
      usersPercent: usersPercentages.averagePercent,
      sessionsPercent: sessionsPercentages.averagePercent,
    });

    return {chartData: Object.values(chartData), chartSummary: summary};
  }

  transformSessionDurationData(responseData): Omit<Data, 'crashFreeTimeBreakdown'> {
    // here we can configure colors of the chart
    const chartData: Series = {
      seriesName: t('Session Duration'),
      data: [],
      lineStyle: {
        opacity: 0,
      },
    };

    const sessionDurationAverage =
      mean(
        responseData
          .map(([timeframe, values]) => {
            chartData.data.push({
              name: timeframe * 1000,
              value: roundDuration(values.duration_p50),
            });

            return values.duration_p50;
          })
          .filter(duration => defined(duration))
      ) || 0;

    const summary = getExactDuration(roundDuration(sessionDurationAverage));

    return {chartData: [chartData], chartSummary: summary};
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
      crashFreeTimeBreakdown: data?.crashFreeTimeBreakdown ?? [],
    });
  }
}

export default ReleaseStatsRequest;
