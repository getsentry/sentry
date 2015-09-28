import $ from "jquery";
import React from "react";
import api from "../../api";
import FlotChart from "../../components/flotChart";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";
import OrganizationHomeContainer from "../../components/organizations/homeContainer";
import OrganizationState from "../../mixins/organizationState";
import RouteMixin from "../../mixins/routeMixin";

import ProjectTable from "./projectTable";

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
      rawProjectData: {received: null, rejected: null, blacklisted: null},
      rawOrgData: {received: null, rejected: null, blacklisted: null},
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
      statsRequestsPending: 3,
      projectsError: false,
      projectsLoading: true,
      projectsRequestsPending: 4
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
    var oBlacklisted = 0;
    var sReceived = {};
    var sRejected = {};
    var sBlacklisted = {};
    var aReceived = [0, 0]; // received, points
    var rawOrgData = this.state.rawOrgData;
    $.each(rawOrgData.received, (idx, point) => {
      var dReceived = point[1];
      var dRejected = rawOrgData.rejected[idx][1];
      var dBlacklisted = rawOrgData.blacklisted[idx][1];
      var ts = point[0] * 1000;
      if (sReceived[ts] === undefined) {
        sReceived[ts] = dReceived;
        sRejected[ts] = dRejected;
        sBlacklisted[ts] = dBlacklisted;
      } else {
        sReceived[ts] += dReceived;
        sRejected[ts] += dRejected;
        sBlacklisted[ts] += dBlacklisted;
      }
      oReceived += dReceived;
      oRejected += dRejected;
      oBlacklisted += dBlacklisted;
      if (dReceived > 0) {
        aReceived[0] += dReceived;
        aReceived[1] += 1;
      }
    });
    this.setState({
      orgStats: {
        rejected: $.map(sRejected, (value, ts) => {
          return [[ts, value || null]];
        }),
        accepted: $.map(sReceived, (value, ts) => {
          return [[ts, value - sRejected[ts]]];
        }),
        blacklisted: $.map(sBlacklisted, (value, ts) => {
          return [[ts, value - sBlacklisted[ts]]];
        })
      },
      orgTotal: {
        received: oReceived,
        rejected: oRejected,
        blacklisted: oBlacklisted,
        accepted: oReceived - oRejected - oBlacklisted,
        avgRate: parseInt((aReceived[0] / aReceived[1]) / 60, 10)
      },
      statsLoading: false
    });
  },

  processProjectData() {
    var rawProjectData = this.state.rawProjectData;
    var projectTotals = [];
    $.each(rawProjectData.received, (projectId, data) => {
      var pReceived = 0;
      var pRejected = 0;
      var pBlacklisted = 0;
      $.each(data, (idx, point) => {
        pReceived += point[1];
        pRejected += rawProjectData.rejected[projectId][idx][1];
        pBlacklisted += rawProjectData.blacklisted[projectId][idx][1];
      });
      projectTotals.push({
        id: projectId,
        received: pReceived,
        rejected: pRejected,
        blacklisted: pBlacklisted,
        accepted: pReceived - pRejected - pBlacklisted
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
        label: 'Events Accepted',
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
        label: 'Events Rejected',
        stack: true,
        lines: {
          lineWidth: 2,
          show: true,
          fill: true
        }
      },
      {
        data: stats.blacklisted,
        color: 'rgba(192, 152, 83, 1)',
        shadowSize: 0,
        label: 'Events Blacklisted',
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
        <div className="row">
          <div className="col-md-9">
            <p>The chart below reflects events the system has received
            across your entire organization. Events are broken down into
            three categories: Accepted, Rejected, and Blacklisted. Rejected
            events are entries that the system threw away due to quotas
            being hit, and Blacklisted events are events that were blocked
            due to your Blacklisted IPs setting.</p>
          </div>
          {!this.state.statsLoading &&
            <div className="col-md-3 stats-column">
              <h6 className="nav-header">Events per minute</h6>
              <p className="count">{this.state.orgTotal.avgRate}</p>
            </div>
          }
        </div>
        <div className="box">
          <div className="box-content with-padding">
            {this.state.statsLoading ?
              <LoadingIndicator />
            : (this.state.statsError ?
              <LoadingError onRetry={this.fetchData} />
            :
              <div style={{height: 250}}>
                <FlotChart plotData={this.getChartPlotData()} className="chart" />
              </div>
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

export default OrganizationStats;
