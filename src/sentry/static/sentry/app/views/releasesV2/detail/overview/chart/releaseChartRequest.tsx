import React from 'react';
import pick from 'lodash/pick';
import omitBy from 'lodash/omitBy';
import isEqual from 'lodash/isEqual';
import meanBy from 'lodash/meanBy';
import {Location} from 'history';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import {GlobalSelection} from 'app/types';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {percent} from 'app/utils';

import {YAxis} from '.';

const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_, key) =>
    ['api', 'version', 'orgId', 'projectSlug', 'children'].includes(key)
  );

type Series = {
  seriesName: string;
  data: {
    name: string | number;
    value: string | number;
  }[];
  color?: string;
  areaStyle?: {
    color: string;
    opacity: number;
  };
};
type ChartData = {
  [key: string]: Series;
};

type RenderProps = {
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  timeseriesData: Series[] | null;
};

type Props = {
  api: Client;
  version: string;
  orgId: string;
  projectSlug: string;
  selection: GlobalSelection;
  location: Location;
  yAxis: YAxis;
  onSummaryChange: (summary: React.ReactNode) => void;
  children: (renderProps: RenderProps) => React.ReactNode;
};
type State = {
  reloading: boolean;
  errored: boolean;
  data: Series[] | null;
};

class ReleaseChartRequest extends React.Component<Props, State> {
  state = {
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
    let data: Series[] | null;
    const {yAxis} = this.props;

    this.setState(state => ({
      reloading: state.data !== null,
      errored: false,
    }));

    try {
      data = await (yAxis === 'crashFree' ? this.fetchRateData : this.fetchCountData)();
    } catch {
      addErrorMessage(t('Error loading chart data'));
      data = null;
      this.setState({
        errored: true,
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

  fetchCountData = async () => {
    const {api, yAxis} = this.props;

    const response = await api.requestPromise(this.statsPath, {
      query: {
        ...this.baseQueryParams,
        type: yAxis,
      },
    });

    return this.transformCountData(response.stats, yAxis);
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

    return this.transformRateData(userResponse.stats, sessionResponse.stats);
  };

  get statsPath() {
    const {orgId, projectSlug, version} = this.props;

    return `/projects/${orgId}/${projectSlug}/releases/${version}/stats/`;
  }

  get baseQueryParams() {
    const {location} = this.props;

    return pick(location.query, [...Object.values(URL_PARAM)]);
  }

  transformCountData(data, yAxis: string): Series[] {
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

    data.forEach(entry => {
      const [timeframe, values] = entry;
      const date = timeframe * 1000;
      summary += values[yAxis];
      chartData.crashed.data.push({name: date, value: values[`${yAxis}_crashed`]});
      chartData.abnormal.data.push({name: date, value: values[`${yAxis}_abnormal`]});
      chartData.errored.data.push({name: date, value: values[`${yAxis}_errored`]});
      chartData.total.data.push({name: date, value: values[yAxis]});
    });

    this.props.onSummaryChange(summary.toLocaleString());

    return Object.values(chartData);
  }

  transformRateData(users, sessions) {
    const chartData: ChartData = {
      users: {
        seriesName: t('Crash Free Users'),
        data: [],
        color: '#FF6969',
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

    const calculateDatePercentage = (data, subject) => {
      const percentageData = data.map(entry => {
        const [timeframe, values] = entry;
        const date = timeframe * 1000;

        const crashFreePercent = Math.round(
          100 - percent(values[`${subject}_crashed`], values[subject])
        );

        return {name: date, value: crashFreePercent};
      });

      const averagePercent = Math.round(meanBy(percentageData, 'value'));

      return {averagePercent, percentageData};
    };

    const usersPercentages = calculateDatePercentage(users, 'users');
    chartData.users.data = usersPercentages.percentageData;

    const sessionsPercentages = calculateDatePercentage(sessions, 'sessions');
    chartData.sessions.data = sessionsPercentages.percentageData;

    this.props.onSummaryChange(
      tct('[usersPercent]% users, [sessionsPercent]% sessions', {
        usersPercent: usersPercentages.averagePercent,
        sessionsPercent: sessionsPercentages.averagePercent,
      })
    );

    return Object.values(chartData);
  }

  render() {
    const {children} = this.props;
    const {data, reloading, errored} = this.state;
    const loading = data === null;

    return children({
      loading,
      reloading,
      errored,
      timeseriesData: data,
    });
  }
}

export default ReleaseChartRequest;
