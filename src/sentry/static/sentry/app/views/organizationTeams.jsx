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
        <div>
          <h3>Teams</h3>
          <p>You dont have any teams for this organization yet. Get started by <a href="#">creating your first team</a>.</p>
        </div>
      );
    }

    return (
      <OrganizationHomeContainer>
        <div className="team-list">
          <h3>Teams</h3>
          {org.teams.map((team, teamIdx) => {
            var teamRouteParams = {
              orgId: org.slug,
              teamId: team.slug
            };
            return (
              <div className="box" key={team.slug}>
                <div className="box-header">
                  <div className="pull-right actions">
                    <a href={urlPrefix + '/teams/' + team.slug + '/settings/'}>
                      <span className="icon-settings"></span> Team Settings
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
