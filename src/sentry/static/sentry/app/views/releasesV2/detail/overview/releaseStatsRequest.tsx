import React from 'react';
import pick from 'lodash/pick';
import omitBy from 'lodash/omitBy';
import isEqual from 'lodash/isEqual';
import meanBy from 'lodash/meanBy';
import mean from 'lodash/mean';
import {Location} from 'history';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import {GlobalSelection, CrashFreeTimeBreakdown} from 'app/types';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {percent, defined} from 'app/utils';
import {Series} from 'app/types/echarts';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {getExactDuration} from 'app/utils/formatters';
import {fetchTotalCount} from 'app/actionCreators/events';

import {YAxis} from './chart/releaseChartControls';
import {getInterval, getReleaseEventView} from './chart/utils';
import {displayCrashFreePercent, getCrashFreePercent} from '../../utils';

const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_, key) =>
    ['api', 'version', 'orgId', 'projectSlug', 'location', 'children'].includes(key)
  );

type ChartData = {
  [key: string]: Series;
};

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
  orgId: string;
  projectSlug: string;
  selection: GlobalSelection;
  location: Location;
  yAxis: YAxis;
  children: (renderProps: ReleaseStatsRequestRenderProps) => React.ReactNode;
  disable: boolean;
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
    const {yAxis, disable} = this.props;

    if (disable) {
      return;
    }

    this.setState(state => ({
      reloading: state.data !== null,
      errored: false,
    }));

    try {
      if (yAxis === YAxis.CRASH_FREE) {
        data = await this.fetchRateData();
      } else if (yAxis === YAxis.EVENTS) {
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
    const {api, orgId, location, selection, version} = this.props;
    const {crashFreeTimeBreakdown} = this.state.data || {};
    let userResponse, eventsCountResponse;

    // we don't need to fetch crashFreeTimeBreakdown every time, because it does not change
    if (crashFreeTimeBreakdown) {
      eventsCountResponse = await fetchTotalCount(
        api,
        orgId,
        getReleaseEventView(selection, version).getEventsAPIPayload(location)
      );
    } else {
      [userResponse, eventsCountResponse] = await Promise.all([
        api.requestPromise(this.statsPath, {
          query: {
            ...this.baseQueryParams,
            type: YAxis.USERS,
          },
        }),
        fetchTotalCount(
          api,
          orgId,
          getReleaseEventView(selection, version).getEventsAPIPayload(location)
        ),
      ]);
    }

    const breakdown = userResponse?.usersBreakdown ?? crashFreeTimeBreakdown;
    const chartSummary = eventsCountResponse.toLocaleString();

    return {chartData: [], crashFreeTimeBreakdown: breakdown, chartSummary};
  };

  get statsPath() {
    const {orgId, projectSlug, version} = this.props;

    return `/projects/${orgId}/${projectSlug}/releases/${version}/stats/`;
  }

  get baseQueryParams() {
    const {location, selection} = this.props;

    return {
      ...getParams(pick(location.query, [...Object.values(URL_PARAM)])),
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
        seriesName: t('Crashed'),
        data: [],
      },
      abnormal: {
        seriesName: t('Abnormal'),
        data: [],
      },
      errored: {
        seriesName: t('Errored'),
        data: [],
      },
      total: {
        seriesName: t('Total'),
        data: [],
      },
    };

    responseData.forEach(entry => {
      const [timeframe, values] = entry;
      const date = timeframe * 1000;
      chartData.crashed.data.push({name: date, value: values[`${yAxis}_crashed`]});
      chartData.abnormal.data.push({name: date, value: values[`${yAxis}_abnormal`]});
      chartData.errored.data.push({name: date, value: values[`${yAxis}_errored`]});
      chartData.total.data.push({name: date, value: values[yAxis]});
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
        seriesName: t('Crash Free Users'),
        data: [],
        color: '#FF6969',
        // TODO(releasesV2): tweak these 4 hex colors
        areaStyle: {
          color: '#FA4747',
          opacity: 0.5,
        },
      },
      sessions: {
        seriesName: t('Crash Free Sessions'),
        data: [],
        color: '#948BCF',
        areaStyle: {
          color: '#C4BFE9',
          opacity: 0.5,
        },
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
    };

    const sessionDurationAverage = Math.round(
      mean(
        responseData
          .map(([timeframe, values]) => {
            chartData.data.push({
              name: timeframe * 1000,
              value: Math.round(values.duration_p50),
            });

            return values.duration_p50;
          })
          .filter(duration => defined(duration))
      ) || 0
    );
    const summary = getExactDuration(sessionDurationAverage ?? 0);

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
