/*** @jsx React.DOM */

var $ = require("jquery");
var moment = require("moment");
var React = require("react");

var api = require("../api");
var ConfigStore = require("../stores/configStore");
var Count = require("../components/count");
var FlotChart = require("../components/flotChart");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var OrganizationHomeContainer = require("../components/organizationHomeContainer");
var OrganizationState = require("../mixins/organizationState");
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
var RouteMixin = require("../mixins/routeMixin");
var utils = require("../utils");

var getPercent = (item, total) => {
  if (total === 0) {
    return '';
  }
  if (item === 0) {
    return '0%';
  }
  return parseInt(item / total * 100) + '%';
};

var timeUnitSize = {
  "second": 1000,
  "minute": 60 * 1000,
  "hour": 60 * 60 * 1000,
  "day": 24 * 60 * 60 * 1000,
  "month": 30 * 24 * 60 * 60 * 1000,
  "quarter": 3 * 30 * 24 * 60 * 60 * 1000,
  "year": 365.2425 * 24 * 60 * 60 * 1000
};

var tickFormatter = (value, axis) => {
  var d = moment(value);

  var t = axis.tickSize[0] * timeUnitSize[axis.tickSize[1]];
  var span = axis.max - axis.min;
  var fmt;

  if (t < timeUnitSize.minute) {
    fmt = 'LT';
  } else if (t < timeUnitSize.day) {
    fmt = 'LT';
    if (span < 2 * timeUnitSize.day) {
      fmt = 'LT';
    } else {
      fmt = 'MMM D LT';
    }
  } else if (t < timeUnitSize.month) {
    fmt = 'MMM D';
  } else if (t < timeUnitSize.year) {
    if (span < timeUnitSize.year) {
      fmt = 'MMM';
    } else {
      fmt = 'MMM YY';
    }
  } else {
    fmt = 'YY';
  }

  return d.format(fmt);
};

var ProjectTable = React.createClass({
  mixins: [PureRenderMixin],

  render() {
    var projectMap = this.props.projectMap;
    var projectTotals = this.props.projectTotals;
    var orgTotal = this.props.orgTotal;
    var org = this.props.organization;
    var urlPrefix = ConfigStore.get('urlPrefix') + '/' + org.slug;

    if (!projectTotals) {
      return <div/>;
    }

    return (
      <table className="table simple-list project-list">
        <thead>
          <tr>
            <th>Project</th>
            <th className="align-right">Accepted</th>
            <th className="align-right">Rejected</th>
            <th className="align-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {$.map(projectTotals, (item) => {
            var acceptedPercent = parseInt(item.accepted / orgTotal.accepted * 100);
            var receivedPercent = parseInt(item.received / orgTotal.received * 100);
            var rejectedPercent = parseInt(item.rejected / orgTotal.rejected * 100);
            var project = projectMap[item.id];

            return (
              <tr key={item.id}>
                <td>
                  <a href={urlPrefix + '/' + project.slug + '/'}>{project.team.name} / {project.name}</a>
                </td>
                <td className="align-right">
                  <Count value={item.accepted} /><br/>
                  <small>{getPercent(item.accepted, orgTotal.accepted)}</small>
                </td>
                <td className="align-right">
                  <Count value={item.rejected} /><br/>
                  <small>{getPercent(item.rejected, orgTotal.rejected)}</small>
                </td>
                <td className="align-right">
                  <Count value={item.received} /><br/>
                  <small>{getPercent(item.received, orgTotal.received)}</small>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
});

var OrganizationStats = React.createClass({
  mixins: [
    OrganizationState,
    RouteMixin
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState() {
    return {
      projectsError: false,
      projectsLoading: false,
      projectsRequestsPending: 0,
      statsError: false,
      statsLoading: false,
      statsRequestsPending: 0,
      projectMap: null,
      rawProjectData: {received: null, rejected: null},
      rawOrgData: {received: null, rejected: null},
      orgStats: null,
      orgTotal: null,
      projectTotals: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate() {
    var state = this.state;
    if (state.statsLoading && !state.statsRequestsPending) {
      this.processOrgData();
    }
    if (state.projectsLoading && !state.projectsRequestsPending) {
      this.processProjectData();
    }
  },

  routeDidChange(nextPath, nextParams) {
    var router = this.context.router;
    if (nextParams.orgId != router.getCurrentParams().orgId) {
      this.fetchData();
    }
  },

  fetchData() {
    this.setState({
      statsError: false,
      statsLoading: true,
      statsRequestsPending: 2,
      projectsError: false,
      projectsLoading: true,
      projectsRequestsPending: 3
    });

    var statEndpoint = this.getOrganizationStatsEndpoint();
    $.each(this.state.rawOrgData, (statName) => {
      api.request(statEndpoint, {
        query: {
          since: new Date().getTime() / 1000 - 3600 * 24 * 7,
          resolution: '1h',
          stat: statName
        },
        success: (data) => {
          this.state.rawOrgData[statName] = data;
          this.state.statsRequestsPending -= 1;
          this.setState({
            rawOrgData: this.state.rawOrgData,
            statsRequestsPending: this.state.statsRequestsPending
          });
        },
        error: () => {
          this.setState({
            statsError: true
          });
        }
      });
    });

    $.each(this.state.rawProjectData, (statName) => {
      api.request(statEndpoint, {
        query: {
          since: new Date().getTime() / 1000 - 3600 * 24 * 7,
          stat: statName,
          group: 'project'
        },
        success: (data) => {
          this.state.rawProjectData[statName] = data;
          this.state.projectsRequestsPending -= 1;
          this.setState({
            rawProjectData: this.state.rawProjectData,
            projectsRequestsPending: this.state.projectsRequestsPending
          });
        },
        error: () => {
          this.setState({
            projectsError: true
          });
        }
      });
    });

    api.request(this.getOrganizationProjectsEndpoint(), {
      success: (data) => {
        var projectMap = {};
        data.forEach((project) => {
          projectMap[project.id] = project;
        });

        this.state.projectsRequestsPending -= 1;
        this.setState({
          projectMap: projectMap,
          projectsRequestsPending: this.state.projectsRequestsPending
        });
      },
      error: () => {
        this.setState({
          projectsError: true
        });
      }
    });
  },

  getOrganizationStatsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return '/organizations/' + params.orgId + '/stats/';
  },

  getOrganizationProjectsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return '/organizations/' + params.orgId + '/projects/';
  },

  processOrgData() {
    var oReceived = 0;
    var oRejected = 0;
    var sReceived = {};
    var sRejected = {};
    var rawOrgData = this.state.rawOrgData;
    $.each(rawOrgData.received, (idx, point) => {
      var dReceived = point[1];
      var dRejected = rawOrgData.rejected[idx][1];
      var ts = point[0] * 1000;
      if (sReceived[ts] === undefined) {
        sReceived[ts] = dReceived;
        sRejected[ts] = dRejected;
      } else {
        sReceived[ts] += dReceived;
        sRejected[ts] += dRejected;
      }
      oReceived += dReceived;
      oRejected += dRejected;
    });
    this.setState({
      orgStats: {
        rejected: $.map(sRejected, (value, ts) => {
          return [[ts, value || null]];
        }),
        accepted: $.map(sReceived, (value, ts) => {
          return [[ts, value - sRejected[ts]]];
        })
      },
      orgTotal: {
        received: oReceived,
        rejected: oRejected,
        accepted: oReceived - oRejected
      },
      statsLoading: false
    });
  },

  processProjectData() {
    var sReceived = {};
    var sRejected = {};
    var rawProjectData = this.state.rawProjectData;
    var projectTotals = [];
    $.each(rawProjectData.received, (projectId, data) => {
      var pReceived = 0;
      var pRejected = 0;
      $.each(data, (idx, point) => {
        pReceived += point[1];
        pRejected += rawProjectData.rejected[projectId][idx][1];
      });
      projectTotals.push({
        id: projectId,
        received: pReceived,
        rejected: pRejected,
        accepted: pReceived - pRejected
      });
    });
    this.setState({
      projectTotals: projectTotals,
      projectsLoading: false
    });
  },

  getChartPlotData() {
    var stats = this.state.orgStats;

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
        label: 'Rejected',
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
    return (
      <OrganizationHomeContainer>
        <h3>Stats</h3>
        <p>The chart below reflects events the system has received across your entire organization. Events are broken down into two categories: Accepted and Rejected. Rejected events are entries that the system threw away due to quotas being hit.</p>

        <div className="box">
          <div className="box-content with-padding">
            {this.state.statsLoading ?
              <LoadingIndicator />
            : (this.state.statsError ?
              <LoadingError onRetry={this.fetchData} />
            :
              <FlotChart plotData={this.getChartPlotData()} className="chart" />
            )}
          </div>
        </div>

        <div className="box">
          <div className="box-header">
            <h3>Events by Project</h3>
          </div>
          <div className="box-content">
            {this.state.projectsLoading ?
              <LoadingIndicator />
            : (this.state.projectsError ?
              <LoadingError onRetry={this.fetchData} />
            :
              <ProjectTable
                  projectTotals={this.state.projectTotals}
                  orgTotal={this.state.orgTotal}
                  organization={this.getOrganization()}
                  projectMap={this.state.projectMap} />
            )}
          </div>
        </div>
      </OrganizationHomeContainer>
    );
  }
});

module.exports = OrganizationStats;
