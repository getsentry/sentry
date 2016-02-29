import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import FlotChart from '../../components/flotChart';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

const ApiChart = React.createClass({
  propTypes: {
    since: React.PropTypes.number.isRequired
  },

  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      error: false,
      loading: true,
      rawData: {
        'client-api.all-versions.responses.2xx': null,
        'client-api.all-versions.responses.4xx': null,
        'client-api.all-versions.responses.5xx': null
      },
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

    statNameList.forEach((statName) => {
      this.api.request('/internal/stats/', {
        method: 'GET',
        data: {
          since: this.props.since,
          resolution: '1h',
          key: statName
        },
        success: (data) => {
          this.state.rawData[statName] = data;
          this.setState({
            rawData: this.state.rawData,
          }, this.requestFinished);
        },
        error: (data) => {
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
    if (rawData['client-api.all-versions.responses.2xx'] && rawData['client-api.all-versions.responses.4xx'] && rawData['client-api.all-versions.responses.5xx']) {
      this.setState({
        loading: false
      });
    }
  },

  processRawSeries(series) {
    return series.map((item) => {
      return [item[0] * 1000, item[1]];
    });
  },

  getChartPoints() {
    let {rawData} = this.state;
    return [
      {
        data: this.processRawSeries(rawData['client-api.all-versions.responses.4xx']),
        color: 'rgb(86, 175, 232)',
        shadowSize: 0,
        label: '4xx',
        stack: true,
        lines: {
          lineWidth: 2,
          show: true,
          fill: true
        }
      },
      {
        data: this.processRawSeries(rawData['client-api.all-versions.responses.5xx']),
        color: 'rgb(244, 63, 32)',
        shadowSize: 0,
        label: '5xx',
        stack: true,
        lines: {
          lineWidth: 2,
          show: true,
          fill: true
        }
      },
      {
        data: this.processRawSeries(rawData['client-api.all-versions.responses.2xx']),
        label: '2xx',
        color: 'rgb(78, 222, 73)',
        shadowSize: 0,
        stack: true,
        lines: {
          lineWidth: 2,
          show: true,
          fill: true
        }
      }
    ];
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;
    return <FlotChart style={{height: 250}} plotData={this.getChartPoints()} />;
  }
});

export default ApiChart;
