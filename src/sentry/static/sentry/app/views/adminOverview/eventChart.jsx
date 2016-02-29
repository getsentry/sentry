import jQuery from 'jquery';
import React from 'react';

import ApiMixin from '../../mixins/apiMixin';
import FlotChart from '../../components/flotChart';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

const EventChart = React.createClass({
  propTypes: {
    since: React.PropTypes.number.isRequired,
    resolution: React.PropTypes.string.isRequired
  },

  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      error: false,
      loading: true,
      rawData: {
        'events.total': null,
        'events.dropped': null,
      },
      stats: {received: [], rejected: []},
      systemTotal: {received: 0, rejected: 0, accepted: 0}
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let statNameList = [
      'events.total',
      'events.dropped',
    ];

    statNameList.forEach((statName) => {
      // query the organization stats via a separate call as its possible the project stats
      // are too heavy
      this.api.request('/internal/stats/', {
        method: 'GET',
        data: {
          since: this.props.since,
          resolution: this.props.resolution,
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
  },

  processOrgData() {
    let {rawData} = this.state;
    let oReceived = 0;
    let oRejected = 0;
    let sReceived = {};
    let sRejected = {};
    let aReceived = [0, 0]; // received, points
    jQuery.each(rawData['events.total'], function(idx, point){
      let dReceived = point[1];
      let dRejected = rawData['events.dropped'][idx][1];
      let ts = point[0] * 1000;
      if (sReceived[ts] === undefined) {
        sReceived[ts] = dReceived;
        sRejected[ts] = dRejected;
      } else {
        sReceived[ts] += dReceived;
        sRejected[ts] += dRejected;
      }
      oReceived += dReceived;
      oRejected += dRejected;
      if (dReceived > 0) {
        aReceived[0] += dReceived;
        aReceived[1] += 1;
      }
    });
    this.setState({
      systemTotal: {
        received: oReceived,
        rejected: oRejected,
        accepted: oReceived - oRejected,
        avgRate: parseInt((aReceived[0] / aReceived[1]) / 60, 10)
      },
      stats: {
        rejected: jQuery.map(sRejected, function(value, ts) {
          return [[ts, value || null]];
        }),
        accepted: jQuery.map(sReceived, function(value, ts) {
          // total number of events accepted (received - rejected)
          return [[ts, value - sRejected[ts]]];
        })
      },
      loading: false
    });
  },

  getChartPoints() {
    let {stats} = this.state;

    return [
      {
        data: stats.accepted,
        label: 'Accepted',
        color: 'rgba(86, 175, 232, 1)',
        shadowSize: 0,
        stack: true,
        lines: {
          lineWidth: 2,
          show: true,
          fill: true
        }
      },
      {
        data: stats.rejected,
        color: 'rgba(244, 63, 32, 1)',
        shadowSize: 0,
        label: 'Dropped',
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

export default EventChart;
