/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import FlotChart from '../components/flotChart';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';

const InternalChart = React.createClass({
  propTypes: {
    since: React.PropTypes.number.isRequired,
    resolution: React.PropTypes.string.isRequired,
    stat: React.PropTypes.string.isRequired,
    label: React.PropTypes.string
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      error: false,
      loading: true,
      data: null,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    this.api.request('/internal/stats/', {
      method: 'GET',
      data: {
        since: this.props.since,
        resolution: this.props.resolution,
        key: this.props.stat,
      },
      success: (data) => {
        this.setState({
          data: data,
          loading: false,
          error: false,
        });
      },
      error: (data) => {
        this.setState({
          error: true
        });
      }
    });
  },

  getChartPoints() {
    let points = this.state.data.map((point) => {
      return [point[0] * 1000, point[1]];
    });



    return [
      {
        data: points,
        label: this.props.label,
        color: 'rgba(86, 175, 232, 1)',
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


const AdminBuffer = React.createClass({
  getInitialState() {
    return {
      since: new Date().getTime() / 1000 - 3600 * 24 * 7,
      resolution: '1h'
    };
  },

  render() {
    // TODO(dcramer): show buffer configuration when its moved into option store
    return (
      <div>
        <h3>Buffers</h3>

        <div className="box">
          <div className="box-header">
            <h4>About</h4>
          </div>

          <div className="box-content with-padding">
            <p>Sentry buffers are responsible for making changes to cardinality counters &mdash; such as an issues event count &mdash; as well as updating attributes like <em>last seen</em>. These are flushed on a regularly interval, and are directly affected by the queue backlog.</p>
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h4>Updates Processed</h4>
          </div>
          <div className="box-content with-padding">
            <InternalChart since={this.state.since}
                           resolution={this.state.resolution}
                           stat="jobs.finished.sentry.tasks.process_buffer.process_incr"
                           label="Jobs" />
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h4>Revoked Updates</h4>
          </div>
          <div className="box-content with-padding">
            <InternalChart since={this.state.since}
                           resolution={this.state.resolution}
                           stat="buffer.revoked"
                           label="Jobs" />
          </div>
        </div>
      </div>
    );
  }
});

export default AdminBuffer;
