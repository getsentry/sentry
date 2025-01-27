import {Component} from 'react';

import type {Client} from 'sentry/api';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {TimeseriesValue} from 'sentry/types/core';
import theme from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';

const initialState = {
  error: false,
  loading: true,
  rawData: {
    'client-api.all-versions.responses.2xx': [],
    'client-api.all-versions.responses.4xx': [],
    'client-api.all-versions.responses.5xx': [],
  },
};

type Props = {
  api: Client;
  resolution: string;
  since: number;
};

type State = {
  error: boolean;
  loading: boolean;
  rawData: Record<string, TimeseriesValue[]>;
};

class ApiChart extends Component<Props, State> {
  state: State = initialState;

  UNSAFE_componentWillMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.props.since !== nextProps.since) {
      this.setState(initialState, this.fetchData);
    }
  }

  fetchData = () => {
    const statNameList = [
      'client-api.all-versions.responses.2xx',
      'client-api.all-versions.responses.4xx',
      'client-api.all-versions.responses.5xx',
    ];

    statNameList.forEach(statName => {
      this.props.api.request('/internal/stats/', {
        method: 'GET',
        data: {
          since: this.props.since,
          resolution: this.props.resolution,
          key: statName,
        },
        success: data => {
          this.setState(prevState => {
            const rawData = prevState.rawData;
            rawData[statName] = data;
            return {
              rawData,
            };
          }, this.requestFinished);
        },
        error: () => {
          this.setState({
            error: true,
          });
        },
      });
    });
  };

  requestFinished = () => {
    const {rawData} = this.state;
    if (
      rawData['client-api.all-versions.responses.2xx'] &&
      rawData['client-api.all-versions.responses.4xx'] &&
      rawData['client-api.all-versions.responses.5xx']
    ) {
      this.setState({
        loading: false,
      });
    }
  };

  processRawSeries(series: TimeseriesValue[]) {
    return series.map(item => ({name: item[0] * 1000, value: item[1]}));
  }

  getChartSeries() {
    const {rawData} = this.state;
    return [
      {
        seriesName: '2xx',
        data: this.processRawSeries(rawData['client-api.all-versions.responses.2xx']!),
        color: theme.green200,
      },
      {
        seriesName: '4xx',
        data: this.processRawSeries(rawData['client-api.all-versions.responses.4xx']!),
        color: theme.blue300,
      },
      {
        seriesName: '5xx',
        data: this.processRawSeries(rawData['client-api.all-versions.responses.5xx']!),
        color: theme.red200,
      },
    ];
  }

  render() {
    const {loading, error} = this.state;
    if (loading) {
      return <LoadingIndicator />;
    }
    if (error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const series = this.getChartSeries();
    const colors = series.map(({color}) => color);
    return (
      <MiniBarChart
        series={series}
        colors={colors}
        height={110}
        stacked
        isGroupedByDate
        showTimeInTooltip
        labelYAxisExtents
      />
    );
  }
}

export default withApi(ApiChart);
