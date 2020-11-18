import React from 'react';

import {Client} from 'app/api';
import {TimeseriesValue} from 'app/types';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import MiniBarChart from 'app/components/charts/miniBarChart';
import withApi from 'app/utils/withApi';
import theme from 'app/utils/theme';

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
  since: number;
  resolution: string;
};

type State = {
  error: boolean;
  loading: boolean;
  rawData: Record<string, TimeseriesValue[]>;
};

class ApiChart extends React.Component<Props, State> {
  state: State = initialState;

  componentWillMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps: Props) {
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
        data: this.processRawSeries(rawData['client-api.all-versions.responses.2xx']),
        color: theme.green200,
      },
      {
        seriesName: '4xx',
        data: this.processRawSeries(rawData['client-api.all-versions.responses.4xx']),
        color: theme.blue300,
      },
      {
        seriesName: '5xx',
        data: this.processRawSeries(rawData['client-api.all-versions.responses.5xx']),
        color: theme.red200,
      },
    ];
  }

  render() {
    const {loading, error} = this.state;
    if (loading) {
      return <LoadingIndicator />;
    } else if (error) {
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
