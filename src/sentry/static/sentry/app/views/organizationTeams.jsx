var React = require("react");
var Reflux = require("reflux");

var api = require("../api");
var BarChart = require("../components/barChart");
var ConfigStore = require("../stores/configStore");
var OrganizationHomeContainer = require("../components/organizationHomeContainer");
var OrganizationState = require("../mixins/organizationState");
var PureRenderMixin = require("react/addons").addons.PureRenderMixin;
var PropTypes = require("../proptypes");
var TeamStore = require("../stores/teamStore");
var {defined, sortArray} = require("../utils");

var ExpandedTeamList = React.createClass({
  propTypes: {
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired,
    projectStats: React.PropTypes.object
  },

  contextTypes: {
    router: React.PropTypes.func
  },

  leaveTeam(team) {
    // TODO(dcramer): handle loading indicator
    api.leaveTeam({
      orgId: this.props.organization.slug,
      teamId: team.slug
    });
  },

  urlPrefix() {
    var org = this.props.organization;
    return ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;
  },

  renderTeamNode(team, urlPrefix) {
    return (
      <div className="box" key={team.slug}>
        <div className="box-header">
          <div className="pull-right actions hidden-xs">
            <a className="leave-team" onClick={this.leaveTeam.bind(this, team)}>
              Leave Team
            </a>
            <a className="team-settings" href={urlPrefix + '/teams/' + team.slug + '/settings/'}>
              Team Settings
            </a>
          </div>
          <h3>{team.name}</h3>
        </div>
        <div className="box-content">
          <table className="table project-list">
            <tbody>{sortArray(team.projects, function(o) {
              return o.name;
            }).map(this.renderProject)}</tbody>
          </table>
        </div>
      </div>
    );
  },

  renderProject(project) {
    var projectStats = this.props.projectStats;
    var projectRouteParams = {
      orgId: this.props.organization.slug,
      projectId: project.slug
    };
    var chartData = null;
    if (projectStats[project.id]) {
      chartData = projectStats[project.id].map((point) => {
        return {x: point[0], y: point[1]};
      });
    }

    return (
      <tr key={project.id}>
        <td>
          <Router.Link to="projectDetails" params={projectRouteParams}>
            {project.name}
          </Router.Link>
        </td>
        <td className="align-right project-chart">
          {chartData && <BarChart points={chartData} className="sparkline" /> }
        </td>
      </tr>
    );
  },

  renderEmpty() {
    return (
      <p>
        {"You dont have any teams for this organization yet. Get started by "}
        <a href={this.urlPrefix() + '/teams/new/'}>creating your first team</a>.
      </p>
    );
  },

  renderTeamNodes() {
    var urlPrefix = this.urlPrefix();
    return this.props.teamList.map((team) => {
      return this.renderTeamNode(team, urlPrefix);
    });
  },

  render() {
    var hasTeams = this.props.teamList.length > 0;

    return (
      <div>
        {hasTeams ? this.renderTeamNodes() : this.renderEmpty() }
      </div>
    );
  }
});

var SlimTeamList = React.createClass({
  propTypes: {
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired,
    openMembership: React.PropTypes.bool
  },

  joinTeam(team) {
    // TODO(dcramer): handle 'requested' case and loading indicator
    api.joinTeam({
      orgId: this.props.organization.slug,
      teamId: team.slug
    });
  },

  leaveTeam(team) {
    // TODO(dcramer): handle loading indicator
    api.leaveTeam({
      orgId: this.props.organization.slug,
      teamId: team.slug
    });
  },

  render() {
    var org = this.props.organization;
    var urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;

    var teamNodes = this.props.teamList.map((team, teamIdx) => {
      var teamRouteParams = {
        orgId: org.slug,
        teamId: team.slug
      };
      return (
        <tr key={team.slug}>
          <td>
            <strong>{team.name}</strong>
          </td>
          <td className="actions align-right">
            {team.isMember ?
              <a className="leave-team btn btn-default btn-sm"
                 onClick={this.leaveTeam.bind(this, team)}>Leave Team</a>
            : (team.isPending ?
              <a className="join-team btn btn-default btn-sm">Request Pending</a>
            : (this.props.openMembership ?
              <a className="join-team btn btn-default btn-sm"
                 onClick={this.joinTeam.bind(this, team)}>Join Team</a>
            :
              <a className="join-team btn btn-default btn-sm"
                 onClick={this.joinTeam.bind(this, team)}>Request Access</a>
            ))}
          </td>
        </tr>
      );
    });

    if (teamNodes.length !== 0) {
      return (
        <table className="table">
          {teamNodes}
        </table>
      );
    }
    return (
      <p>You dont have any teams for this organization yet. Get started by <a href={urlPrefix + '/teams/new/'}>creating your first team</a>.</p>
    );
  }
});

var OrganizationStatOverview = React.createClass({
  mixins: [
    OrganizationState
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState() {
    return {
      totalRejected: null,
      epm: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  getOrganizationStatsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return '/organizations/' + params.orgId + '/stats/';
  },

  fetchData() {
    var statsEndpoint = this.getOrganizationStatsEndpoint();
    api.request(statsEndpoint, {
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'rejected'
      },
      success: (data) => {
        var totalRejected = 0;
        data.forEach((point) => {
          totalRejected += point[1];
        });
        this.setState({totalRejected: totalRejected});
      }
    });
    api.request(statsEndpoint, {
      query: {
        since: new Date().getTime() / 1000 - 3600 * 3,
        resolution: '1h',
        stat: 'received'
      },
      success: (data) => {
        var received = [0, 0];
        data.forEach((point) => {
          if (point[1] > 0) {
            received[0] += point[1];
            received[1] += 1;
          }
        });
        var epm = (received[1] ? parseInt((received[0] / received[1]) / 60, 10) : 0);
        this.setState({epm: epm});
      }
    });
  },

  render() {
    if (!defined(this.state.epm) || !defined(this.state.totalRejected))
      return null;

    var router = this.context.router;
    var access = this.getAccess();

    return (
      <div className={this.props.className}>
        <h6 className="navheader">Events Per Minute</h6>
        <p className="count">{this.state.epm}</p>
        <h6 className="navheader">Rejected in last 24h</h6>
        <p className="count rejected">{this.state.totalRejected}</p>
        {access.has('org:read') &&
          <Router.Link to="organizationStats" params={router.getCurrentParams()}
                       className="stats-link">View all stats</Router.Link>
        }
      </div>
    );
  }
});

var OrganizationTeams = React.createClass({
  mixins: [
    OrganizationState,
    Reflux.listenTo(TeamStore, "onTeamListChange")
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState() {
    return {
      activeNav: 'your-teams',
      teamList: sortArray(TeamStore.getAll(), function(o) {
        return o.name;
      }),
      projectStats: {},
    };
  },

  componentWillMount() {
    this.fetchStats();
  },

  // TODO(dcramer): handle updating project stats when items change
  fetchStats() {
    api.request(this.getOrganizationStatsEndpoint(), {
      query: {
        since: new Date().getTime() / 1000 - 3600 * 24,
        stat: 'received',
        group: 'project'
      },
      success: (data) => {
        this.setState({
          projectStats: data
        });
      }
    });
  },

  getOrganizationStatsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return '/organizations/' + params.orgId + '/stats/';
  },

  onTeamListChange() {
    var newTeamList = TeamStore.getAll();

    this.setState({
      teamList: sortArray(newTeamList, function(o) {
        return o.name;
      })
    });

    this.fetchStats();
  },

  toggleTeams(nav) {
    this.setState({
      activeNav: nav
    });
  },

  render() {
    var access = this.getAccess();
    var features = this.getFeatures();
    var org = this.getOrganization();
    var urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;

    var activeNav = this.state.activeNav;
    var allTeams = this.state.teamList;
    var activeTeams = this.state.teamList.filter((team) => team.isMember);

    return (
      <OrganizationHomeContainer>
        <div className="row">
          <div className="col-md-9">
            <div className="team-list">
              <div className="pull-right">
                <a href={urlPrefix + '/projects/new/'} className="btn btn-primary btn-sm"
                   style={{marginRight: 5}}>
                  <span className="icon-plus" /> Project
                </a>
                <a href={urlPrefix + '/teams/new/'} className="btn btn-primary btn-sm">
                  <span className="icon-plus" /> Team
                </a>
              </div>
              <ul className="nav nav-tabs border-bottom">
                <li className={activeNav === "your-teams" && "active"}>
                  <a onClick={this.toggleTeams.bind(this, "your-teams")}>Your Teams</a>
                </li>
                <li className={activeNav === "all-teams" && "active"}>
                  <a onClick={this.toggleTeams.bind(this, "all-teams")}>All Teams</a>
                </li>
              </ul>
              {activeNav == 'your-teams' ?
                <ExpandedTeamList
                    organization={org} teamList={activeTeams}
                    projectStats={this.state.projectStats} />
              :
                <SlimTeamList
                  organization={org} teamList={allTeams}
                  openMembership={features.has('open-membership') || access.has('org:write')} />
              }
            </div>
          </div>
          <OrganizationStatOverview className="col-md-3 stats-column" />
        </div>
      </OrganizationHomeContainer>
    );
  }
});

module.exports = OrganizationTeams;
