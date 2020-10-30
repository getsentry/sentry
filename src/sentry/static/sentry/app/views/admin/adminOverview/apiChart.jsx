import PropTypes from 'prop-types';
import React from 'react';

import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import MiniBarChart from 'app/components/charts/miniBarChart';
import withApi from 'app/utils/withApi';
import theme from 'app/utils/theme';

class ApiChart extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    since: PropTypes.number.isRequired,
    resolution: PropTypes.string.isRequired,
  };

  state = this.getInitialState();

  getInitialState() {
    return {
      error: false,
      loading: true,
      rawData: {
        'client-api.all-versions.responses.2xx': null,
        'client-api.all-versions.responses.4xx': null,
        'client-api.all-versions.responses.5xx': null,
      },
    };
  }

  componentWillMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.since !== nextProps.since) {
      this.setState(this.getInitialState(), this.fetchData);
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
    if (rawData['events.total'] && rawData['events.dropped']) {
      this.processOrgData();
    }
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

  processRawSeries(series) {
    return series.map(item => ({name: item[0] * 1000, value: item[1]}));
  }

  getChartSeries() {
    const {rawData} = this.state;
    return [
      {
        seriesName: '2xx',
        data: this.processRawSeries(rawData['client-api.all-versions.responses.2xx']),
        color: theme.green300,
      },
      {
        seriesName: '4xx',
        data: this.processRawSeries(rawData['client-api.all-versions.responses.4xx']),
        color: theme.blue300,
      },
      {
        seriesName: '5xx',
        data: this.processRawSeries(rawData['client-api.all-versions.responses.5xx']),
        color: theme.red300,
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
