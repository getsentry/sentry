import React from 'react';
import moment from 'moment';
import {AreaChart, Area, CartesianGrid, ReferenceLine,
        ResponsiveContainer, Tooltip, YAxis, XAxis} from 'recharts';

import ActivityFeed from '../../components/activity/feed';
import ApiMixin from '../../mixins/apiMixin';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import ReleaseList from '../../components/releaseList';
import Version from '../../components/version';

const CustomTooltip = React.createClass({
  propTypes: {
    active: React.PropTypes.boolean,
    payload: React.PropTypes.array,
    label: React.PropTypes.string,
  },

  render() {
    const {active} = this.props;

    if (active) {
      const {payload, label} = this.props;
      return (
        <div className="tooltip-inner">
          <div className="time-label">{label}</div>
          <dl className="value-labelset">
            {payload.map((item, idx) => {
              return [
                <dt key={`dt-${idx}`}>
                  <span className="color">
                    <span style={{background: item.fill, opacity: item.fillOpacity}} />
                  </span>
                  {item.value}
                </dt>,
                <dd key={`dd-${idx}`}><Version version={item.name} anchor={false} /></dd>,
              ];
          })}
          </dl>
        </div>
      );
    }

    return null;
  }
});

export default React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      releaseStats: null,
      releaseList: null,
      error: false,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    this.fetchReleases();
    this.fetchReleaseStats();
  },

  fetchReleases() {
    let {orgId, projectId} = this.props.params;
    let path = `/projects/${orgId}/${projectId}/releases/`;
    this.api.request(path, {
      success: (data) => {
        this.setState({
          error: false,
          releaseList: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      }
    });
  },

  fetchReleaseStats() {
    let {orgId, projectId} = this.props.params;
    let path = `/projects/${orgId}/${projectId}/releases/stats/`;
    this.api.request(path, {
      success: (data) => {
        this.setState({
          error: false,
          releaseStats: data,
        });
      },
      error: () => {
        this.setState({
          error: true,
        });
      }
    });
  },

  getActivityEndpoint() {
    let {orgId, projectId} = this.props.params;
    return '/projects/' + orgId + '/' + projectId + '/releases/activity/';
  },

  renderChart() {
    let grays = ['#d3d3d3', '#a8a8a8', '#7e7e7e'];
    let purple = '#8F85D4';
    // just use 30 days for now
    let stats = this.state.releaseStats.stats['30d'];
    // filter out releases that have 0 events ever so
    // that tooltip doesn't get crazy
    let releasesWithEvents = new Set();
    stats.forEach(stat => {
      Object.keys(stat[1]).forEach(release => {
        if (stat[1][release] > 0) {
          releasesWithEvents.add(release);
        }
      });
    });
    let data = this.state.releaseStats.stats['30d'].map(stat => {
      let point = {
        name: moment(stat[0] * 1000).format('ll'),
      };
      releasesWithEvents.forEach(release => {
        point[release] = stat[1][release];
      });
      return point;
    });
    let deploys = this.state.releaseStats.deploys;
    let releases = this.state.releaseStats.releases.filter(release => {
      return releasesWithEvents.has(release.version);
    });
    return (
      <ResponsiveContainer minHeight={250}>
        <AreaChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
          {deploys.map(d => {
            return (
              <ReferenceLine x={moment(d.dateFinished * 1000).format('ll')}
                             key={d.id}
                             label={d.environment}
                             stroke="#2a2a2a" alwaysShow={true}/>
            );
          })}
          {releases.map((release, i) => {
            let color = i === 0 ? purple : grays[i % 3];
            return (
              <Area key={release.version} type="monotone"
                    dataKey={release.version} fill={color}
                    fillOpacity={0.5} stroke={color} stackId="1"
                    isAnimationActive={false} />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    );
  },

  renderBody() {
    if (this.state.releaseList === null || this.state.releaseStats === null) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError />;
    }

    let {orgId, projectId} = this.props.params;
    let {releaseList, releaseStats} = this.state;
    return (
      <div>
        <div className="row">
          <div className="col-sm-3 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Average New Issues</h6>
              <span className="stream-count">
                {Math.round(releaseStats.AvgNewGroups * 100) / 100}
              </span>
            </div>
          </div>
          <div className="col-sm-3 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Average Number of Authors</h6>
              <span className="stream-count">
                {Math.round(releaseStats.AvgNumAuthors * 100) / 100}
              </span>
            </div>
          </div>
          <div className="col-sm-3 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Time Between Releases</h6>
              <span className="stream-count">
                {moment.duration(releaseStats.AvgTimeToRelease).humanize()}
              </span>
            </div>
          </div>
          <div className="col-sm-3 hidden-xs">
            <div className="release-stats">
              <h6 className="nav-header">Total Releases</h6>
              <span className="stream-count">{releaseStats.CountReleases}</span>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-md-12">
            <h5>Events Per Release</h5>
            {this.renderChart()}
          </div>
        </div>
        <div className="row">
          <div className="col-md-8">
            <div className="panel panel-default">
              <div className="panel-heading panel-heading-bold">
                <div className="row">
                  <div className="col-sm-8 col-xs-7">Version</div>
                  <div className="col-sm-2 col-xs-3">
                    New Issues
                  </div>
                  <div className="col-sm-2 col-xs-2">
                    Last Event
                  </div>
                </div>
              </div>

              <ReleaseList releaseList={releaseList} orgId={orgId} projectId={projectId} />
            </div>
          </div>
          <div className="col-md-4">
            <ActivityFeed ref="activityFeed" endpoint={this.getActivityEndpoint()} query={{
              per_page: 10,
            }} pagination={false} {...this.props}/>
          </div>
        </div>
      </div>
    );
  },

  render() {
    return (
      <div className="release-details">
        {this.renderBody()}
      </div>
    );
  }
});
