import React from 'react';
import pick from 'lodash/pick';
import omitBy from 'lodash/omitBy';
import isEqual from 'lodash/isEqual';
import meanBy from 'lodash/meanBy';
import {Location} from 'history';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct, tn} from 'app/locale';
import {GlobalSelection, CrashFreeTimeBreakdown} from 'app/types';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {percent, defined} from 'app/utils';
import {Series} from 'app/types/echarts';

import {displayCrashFreePercent, getCrashFreePercent} from '../../../utils';
import {YAxis} from './releaseChartControls';

const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_, key) =>
    ['api', 'version', 'orgId', 'projectSlug', 'children'].includes(key)
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
    const {yAxis} = this.props;

    this.setState(state => ({
      reloading: state.data !== null,
      errored: false,
    }));

    try {
      if (yAxis === 'crashFree') {
        data = await this.fetchRateData();
      } else {
        // session duration uses same endpoint as sessions
        data = await this.fetchCountData(
          yAxis === 'sessionDuration' ? 'sessions' : yAxis
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
      yAxis === 'sessionDuration'
        ? this.transformSessionDurationData(response.stats)
        : this.transformCountData(response.stats, yAxis);

    return {...transformedData, crashFreeTimeBreakdown: response.usersBreakdown};
  };

  fetchRateData = async () => {
    const {api} = this.props;

    const [userResponse, sessionResponse] = await Promise.all([
      api.requestPromise(this.statsPath, {
        query: {
          ...this.baseQueryParams,
          type: 'users',
        },
      }),
      api.requestPromise(this.statsPath, {
        query: {
          ...this.baseQueryParams,
          type: 'sessions',
        },
      }),
    ]);

    const transformedData = this.transformRateData(
      userResponse.stats,
      sessionResponse.stats
    );

    return {...transformedData, crashFreeTimeBreakdown: userResponse.usersBreakdown};
  };

  get statsPath() {
    const {orgId, projectSlug, version} = this.props;

    return `/projects/${orgId}/${projectSlug}/releases/${version}/stats/`;
  }

  get baseQueryParams() {
    const {location} = this.props;

    return pick(location.query, [...Object.values(URL_PARAM)]);
  }

  transformCountData(responseData, yAxis: string): Omit<Data, 'crashFreeTimeBreakdown'> {
    let summary = 0;
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
      summary += values[yAxis];
      chartData.crashed.data.push({name: date, value: values[`${yAxis}_crashed`]});
      chartData.abnormal.data.push({name: date, value: values[`${yAxis}_abnormal`]});
      chartData.errored.data.push({name: date, value: values[`${yAxis}_errored`]});
      chartData.total.data.push({name: date, value: values[yAxis]});
    });

    return {chartData: Object.values(chartData), chartSummary: summary.toLocaleString()};
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

    const calculateDatePercentage = (responseData, subject) => {
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

    const usersPercentages = calculateDatePercentage(responseUsersData, 'users');
    chartData.users.data = usersPercentages.percentageData;

    const sessionsPercentages = calculateDatePercentage(responseSessionsData, 'sessions');
    chartData.sessions.data = sessionsPercentages.percentageData;

    const summary = tct('[usersPercent] users, [sessionsPercent] sessions', {
      usersPercent: usersPercentages.averagePercent,
      sessionsPercent: sessionsPercentages.averagePercent,
    });

    return {chartData: Object.values(chartData), chartSummary: summary};
  }

  transformSessionDurationData(data): Omit<Data, 'crashFreeTimeBreakdown'> {
    // here we can configure colors of the chart
    const chartData: Series = {
      seriesName: t('Session Duration'),
      data: [],
    };

    data.forEach(entry => {
      const [timeframe, values] = entry;
      const date = timeframe * 1000;
      chartData.data.push({name: date, value: values.duration_p50});
    });

    const sessionDurationAverage = meanBy(
      chartData.data.filter(item => defined(item.value)),
      'value'
    );
    const summary = tn('%s second', '%s seconds', sessionDurationAverage ?? 0);

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
      crashFreeTimeBreakdown: data?.crashFreeTimeBreakdown ?? {},
    });
  }
}

export default ReleaseStatsRequest;
