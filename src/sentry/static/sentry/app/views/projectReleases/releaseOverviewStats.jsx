import React from 'react';
import moment from 'moment';
import {AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip} from 'recharts';

import ApiMixin from '../../mixins/apiMixin';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';

const ReleaseOverviewStats = React.createClass({

  mixins: [ApiMixin],

  getInitialState() {
    return {
      data: null,
      loading: true,
      error: false,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    this.api.request(this.getProjectReleaseStatsEndpoint(), {
      success: (data) => {
        this.setState({
          error: false,
          loading: false,
          data: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  getProjectReleaseStatsEndpoint() {
    let {orgId, projectId} = this.props.params;
    return '/projects/' + orgId + '/' + projectId + '/releases/stats/';
  },

  renderChart() {
    let colors = ['#8884d8', '#82ca9d', '#ffc658'];
    // just use 30 days for now
    let stats = this.state.data.stats['30d'];
    // filter out releases that have 0 events ever so
    // that tooltip doesn't get crazy
    let releases = new Set();
    stats.forEach(stat => {
      Object.keys(stat[1]).forEach(release => {
        if (stat[1][release] > 0) {
          releases.add(release);
        }
      });
    });
    let data = this.state.data.stats['30d'].map(stat => {
      let point = {
        name: moment(stat[0] * 1000).format('ll'),
      };
      releases.forEach(release => {
        point[release] = stat[1][release];
      });
      return point;
    });
    return (
      <AreaChart width={730} height={250} data={data}
        margin={{top: 10, right: 30, left: 0, bottom: 0}}>
        <XAxis dataKey="name" />
        <YAxis />
        <CartesianGrid strokeDasharray="3 3" />
        <Tooltip />
        {Array.from(releases).map((stat, i) => {
          return (
            <Area key={stat} type="monotone" dataKey={stat} fill={colors[i % 3]}
                  stroke={colors[i % 3]} fillOpacity={1} stackId="1" />
          );
        })}
      </AreaChart>
    );
  },

  renderBody() {
    let body;

    if (this.state.loading) {
      body = <LoadingIndicator />;
    } else if (this.state.error) {
      body = <LoadingError />;
    } else {
      let data = this.state.data;
      body = (
        <div className="row">
          <div className="col-sm-4 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Average Number of Authors</h6>
              <span className="stream-count">
                {Math.round(data.AvgNumAuthors * 100) / 100}
              </span>
            </div>
          </div>
          <div className="col-sm-4 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Time Between Releases</h6>
              <span className="stream-count">
                {moment.duration(data.AvgTimeToRelease).humanize()}
              </span>
            </div>
          </div>
          <div className="col-sm-4 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Total Releases</h6>
              <span className="stream-count">{data.CountReleases}</span>
            </div>
          </div>
          <div>{this.renderChart()}</div>
        </div>
      );
    }

    return body;
  },

  render() {
    return (
      <div className="release-details">
        {this.renderBody()}
      </div>
    );
  }
});

export default ReleaseOverviewStats;
