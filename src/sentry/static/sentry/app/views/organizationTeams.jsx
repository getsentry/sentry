/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");

var api = require("../api");
var ConfigStore = require("../stores/configStore");
var OrganizationHomeContainer = require("../components/organizationHomeContainer");
var OrganizationState = require("../mixins/organizationState");
var PureRenderMixin = require("react/addons").addons.PureRenderMixin;
var PropTypes = require("../proptypes");
var TeamStore = require("../stores/teamStore");

var ExpandedTeamList = React.createClass({
  mixins: [PureRenderMixin],

  propTypes: {
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired
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
        <div className="box" key={team.slug}>
          <div className="box-header">
            <div className="pull-right actions">
              <a className="new-project" href={urlPrefix + '/projects/new/'}>
                New Project
              </a>
              <a className="leave-team" href="#">
                Leave Team
              </a>
              <a className="team-settings" href={urlPrefix + '/teams/' + team.slug + '/settings/'}>
                Team Settings
              </a>
            </div>
            <h3>
              <Router.Link
                to="teamDetails"
                params={teamRouteParams}>{team.name}</Router.Link>
            </h3>
          </div>
          <div className="box-content with-padding">
            <ul className="projects">
              {team.projects.map((project) => {
                // <p>There are no projects in this team. Would you like to <a href="#">create a project</a>?</p>
                var projectRouteParams = {
                  orgId: org.slug,
                  projectId: project.slug
                };

                return (
                  <li key={project.slug}>
                    <Router.Link
                        to="projectDetails"
                        params={projectRouteParams}>
                      {project.name}
                    </Router.Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      );
    });

    return (
      <div>
        {teamNodes.length ?
          {teamNodes}
        :
          <p>You dont have any teams for this organization yet. Get started by <a href={urlPrefix + '/teams/new/'}>creating your first team</a>.</p>
        }
      </div>
    );
  }
});

var SlimTeamList = React.createClass({
  mixins: [PureRenderMixin],

  propTypes: {
    organization: PropTypes.Organization.isRequired,
    teamList: React.PropTypes.arrayOf(PropTypes.Team).isRequired
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
        <div className="box" key={team.slug}>
          <div className="box-header">
            <div className="pull-right actions">
              {team.isMember ?
                <a className="leave-team" href="#">Leave Team</a>
              :
                <a className="join-team" href="#">Request Access</a>
              }
            </div>
            <h3>{team.name}</h3>
          </div>
        </div>
      );
    });

    return (
      <div>
        {teamNodes.length ?
          {teamNodes}
        :
          <p>You dont have any teams for this organization yet. Get started by <a href={urlPrefix + '/teams/new/'}>creating your first team</a>.</p>
        }
      </div>
    );
  }
});

var OrganizationTeams = React.createClass({
  mixins: [
    OrganizationState,
    PureRenderMixin,
    Reflux.listenTo(TeamStore, "onTeamListChange")
  ],

  getInitialState() {
    return {
      activeNav: 'your-teams',
      teamList: []
    };
  },

  onTeamListChange() {
    var newTeamList = TeamStore.getAll();

    this.setState({
      teamList: newTeamList
    });
  },

  toggleTeams(nav) {
    this.setState({
      activeNav: nav
    });
  },

  render() {
    var org = this.getOrganization();
    var urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;

    var activeNav = this.state.activeNav;
    var allTeams = this.state.teamList;
    var activeTeams = this.state.teamList.filter((team) => team.isMember);

    return (
      <OrganizationHomeContainer>
        <div className="team-list">
          <div className="pull-right">
            <a href={urlPrefix + '/teams/new/'} className="new-team">
              <span className="icon-plus"></span> Create Team
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
            <ExpandedTeamList organization={org} teamList={activeTeams} />
          :
            <SlimTeamList
                organization={org} teamList={allTeams} />
          }
        </div>
      </OrganizationHomeContainer>
    );
  }
});

module.exports = OrganizationTeams;
