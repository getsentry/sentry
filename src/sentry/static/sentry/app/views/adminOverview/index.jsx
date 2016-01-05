/*eslint getsentry/jsx-needs-il8n:0*/
import React from 'react';

import ApiChart from './apiChart';
import EventChart from './eventChart';

const AdminOverview = React.createClass({
  getInitialState() {
    return {
      since: new Date().getTime() / 1000 - 3600 * 24 * 7,
      resolution: '1h'
    };
  },

  render() {
    return (
      <div>
        <h3>System Overview</h3>

        <div className="box">
          <div className="box-header">
            <h4>
              Event Throughput
              <span id="rate" className="pull-right"></span>
            </h4>
          </div>
          <div className="box-content with-padding">
            <EventChart since={this.state.since}
                        resolution={this.state.resolution} />
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h4>API Responses</h4>
          </div>
          <div className="box-content with-padding">
            <ApiChart since={this.state.since}
                      resolution={this.state.resolution} />
          </div>
        </div>
      </div>
    );
  }
});

export default AdminOverview;
