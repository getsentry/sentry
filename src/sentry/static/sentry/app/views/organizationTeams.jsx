/*** @jsx React.DOM */

var React = require("react");

var ConfigStore = require("../stores/configStore");
var OrganizationHomeContainer = require("../components/organizationHomeContainer");
var OrganizationState = require("../mixins/organizationState");

var OrganizationTeams = React.createClass({
  mixins: [OrganizationState],

  render() {
    var org = this.getOrganization();
    var urlPrefix = ConfigStore.get('urlPrefix') + '/organizations/' + org.slug;

    if (org.teams.length === 0) {
      return (
        <div className="team-list">
          <ul class="nav nav-tabs border-bottom">
            <li class="active"><a href="#">Your Teams</a></li>
            <li class=""><a href="#">All Teams</a></li>
          </ul>
          <p>You dont have any teams for this organization yet. Get started by <a href="#">creating your first team</a>.</p>
        </div>
      );
    }

    return (
      <OrganizationHomeContainer>
        <div className="team-list">
          <div className="pull-right">
            <a href={urlPrefix + '/teams/new/'} className="new-team"><span className="icon-plus"></span> Create Team</a>
          </div>
          <ul className="nav nav-tabs border-bottom">
            <li className="active"><a href="#">Your Teams</a></li>
            <li className=""><a href="#">All Teams</a></li>
          </ul>
          {org.teams.map((team, teamIdx) => {
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
          })}
        </div>
      </OrganizationHomeContainer>
    );
  }
});

module.exports = OrganizationTeams;
