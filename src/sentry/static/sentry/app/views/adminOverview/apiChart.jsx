import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import StackedBarChart from '../../components/stackedBarChart';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

export default React.createClass({
  propTypes: {
    since: React.PropTypes.number.isRequired,
    resolution: React.PropTypes.string.isRequired
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      error: false,
      loading: true,
      rawData: {
        'client-api.all-versions.responses.2xx': null,
        'client-api.all-versions.responses.4xx': null,
        'client-api.all-versions.responses.5xx': null
      }
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let statNameList = [
      'client-api.all-versions.responses.2xx',
      'client-api.all-versions.responses.4xx',
      'client-api.all-versions.responses.5xx'
    ];

    statNameList.forEach(statName => {
      this.api.request('/internal/stats/', {
        method: 'GET',
        data: {
          since: this.props.since,
          resolution: '1h',
          key: statName
        },
        success: data => {
          this.state.rawData[statName] = data;
          this.setState(
            {
              rawData: this.state.rawData
            },
            this.requestFinished
          );
        },
        error: data => {
          this.setState({
            error: true
          });
        }
      });
    });
  },

  requestFinished() {
    let {rawData} = this.state;
    if (rawData['events.total'] && rawData['events.dropped']) {
      this.processOrgData();
    }
    if (
      rawData['client-api.all-versions.responses.2xx'] &&
      rawData['client-api.all-versions.responses.4xx'] &&
      rawData['client-api.all-versions.responses.5xx']
    ) {
      this.setState({
        loading: false
      });
    }
  },

  processRawSeries(series) {
    return series.map(item => {
      return {x: item[0], y: item[1]};
    });
  },

  getChartSeries() {
    let {rawData} = this.state;
    return [
      {
        data: this.processRawSeries(rawData['client-api.all-versions.responses.4xx']),
        color: 'rgb(86, 175, 232)',
        shadowSize: 0,
        label: '4xx'
      },
      {
        data: this.processRawSeries(rawData['client-api.all-versions.responses.5xx']),
        color: 'rgb(244, 63, 32)',
        label: '5xx'
      },
      {
        data: this.processRawSeries(rawData['client-api.all-versions.responses.2xx']),
        color: 'rgb(78, 222, 73)',
        label: '2xx'
      }
    ];
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;
    return (
      <StackedBarChart
        series={this.getChartSeries()}
        height={150}
        className="standard-barchart"
      />
    );
  }
});
