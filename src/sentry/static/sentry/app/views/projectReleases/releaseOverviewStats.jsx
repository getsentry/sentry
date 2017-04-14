import React from 'react';
import moment from 'moment';
import _ from 'underscore';
import {AreaChart, Area, CartesianGrid, ReferenceLine,
        ResponsiveContainer, Tooltip, YAxis, XAxis} from 'recharts';

import ActivityFeed from '../../components/activity/feed';
import ApiMixin from '../../mixins/apiMixin';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import ReleaseList from '../../components/releaseList';
import Version from '../../components/version';


const CustomLabel = React.createClass({
  propTypes: {
    deploy: React.PropTypes.object,
    idx: React.PropTypes.number,
  },

  render() {
    let deploy = this.props.deploy;
    let idx = this.props.idx;
    let label = 'Deployed to ' + deploy.environment;
    let props = _.omit(this.props, 'deploy', 'idx');
    props.y = props.y + (idx % 3 * 20);
    return (
      <text {...props}>
        <tspan>{label}</tspan>
      </text>
    );
  }
});

const CustomTooltip = React.createClass({
  propTypes: {
    active: React.PropTypes.bool,
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
    // only include top 3 releases + latest
    let totalsByRelease = {};
    stats.forEach(stat => {
      Object.keys(stat[1]).forEach(release => {
        if (!totalsByRelease[release]) {
          totalsByRelease[release] = {
            release: release,
            count: 0,
          };
        }
        totalsByRelease[release].count += stat[1][release];
      });
    });
    let latestRelease = this.state.releaseStats.releases[0];
    let topReleases = _.sortBy(Object.values(totalsByRelease), 'count').reverse();
    let latestReleaseIdx = _.findIndex(topReleases, r => {
      return r.release === latestRelease.version;
    });
    if (latestReleaseIdx <= 3) {
      topReleases = new Set(_.pluck(topReleases.slice(0, 4), 'release'));
    } else {
      topReleases = new Set(_.pluck(topReleases.slice(0, 3), 'release'));
      topReleases.add(latestRelease.version);
    }

    let data = this.state.releaseStats.stats['30d'].map(stat => {
      let point = {
        name: moment(stat[0] * 1000).format('ll'),
      };
      topReleases.forEach(release => {
        point[release] = stat[1][release];
      });
      return point;
    });
    let deploysByDate = {};
    this.state.releaseStats.deploys.forEach(d => {
      let date = moment(d.dateFinished * 1000).format('ll');
      if (!deploysByDate[date]) {
        deploysByDate[date] = {
          count: 0,
          environment: new Set(),
          date: date,
          timestamp: d.dateFinished,
        };
      }
      deploysByDate[date].count += 1;
      deploysByDate[date].environment.add(d.environment);
    });
    let deploys = _.sortBy(Object.values(deploysByDate), 'timestamp');
    deploys.forEach(d => {
      d.environment = Array.from(d.environment).join(', ');
    });

    let releases = this.state.releaseStats.releases.filter((release, i) => {
      return i === 0 || topReleases.has(release.version);
    });
    return (
      <ResponsiveContainer minHeight={250}>
        <AreaChart data={data}>
          <XAxis dataKey="name" />
          <YAxis />
          <CartesianGrid strokeDasharray="3 3" />
          <Tooltip content={<CustomTooltip />} isAnimationActive={false} />
          {deploys.map((d, i) => {
            return (
              <ReferenceLine x={d.date}
                             key={d.date}
                             label={<CustomLabel deploy={d} idx={i}/>}
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
        <div className="release-metrics row m-b-2">
          <div className="col-sm-3 hidden-xs">
            <div className="release-metric">
              <h6 className="nav-header">Average New Issues</h6>
              <span className="release-metric-count">
                {Math.round(releaseStats.AvgNewGroups * 100) / 100}
              </span>
            </div>
          </div>
          <div className="col-sm-3 hidden-xs">
            <div className="release-metric">
              <h6 className="nav-header">Average Number of Authors</h6>
              <span className="release-metric-count">
                {Math.round(releaseStats.AvgNumAuthors * 100) / 100}
              </span>
            </div>
          </div>
          <div className="col-sm-3 hidden-xs">
            <div className="release-metric">
              <h6 className="nav-header">Time Between Releases</h6>
              <span className="release-metric-count">
                {moment.duration(releaseStats.AvgTimeToRelease).humanize()}
              </span>
            </div>
          </div>
          <div className="col-sm-3 hidden-xs">
            <div className="release-metric">
              <h6 className="nav-header">Total Releases</h6>
              <span className="release-metric-count">{releaseStats.CountReleases}</span>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-md-12">
            <h5>Events per release</h5>
            <div className="panel panel-default m-b-2">
              <div className="release-graph-wrapper">
                <div className="release-graph">
                  {this.renderChart()}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="row">
          <div className="col-md-8">
            <h5>Recent releases</h5>
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
            <div className="release-activity">
              <h5>Recent activity</h5>
              <ActivityFeed ref="activityFeed" endpoint={this.getActivityEndpoint()} query={{
                per_page: 10,
              }} pagination={false} {...this.props}/>
            </div>
          </div>
        </div>
      </div>
    );
  },

  render() {
    return (
      <div>
        {this.renderBody()}
      </div>
    );
  }
});
