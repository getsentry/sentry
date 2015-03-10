/*** @jsx React.DOM */

var React = require("react");

var OrganizationHomeSidebar = require("../components/organizationHomeSidebar");
var OrganizationState = require("../mixins/organizationState");

var OrganizationTeams = React.createClass({
  mixins: [OrganizationState],

  render() {
    var org = this.getOrganization();

    if (org.teams.length === 0) {
      return (
        <div>
          <h3>Teams</h3>
          <p>You dont have any teams for this organization yet. Get started by <a href="#">creating your first team</a>.</p>
        </div>
      );
    }

    return (
      <div>
        <OrganizationHomeSidebar />
        <h3>Teams</h3>
        {org.teams.map((team, teamIdx) => {
          var teamRouteParams = {
            orgId: org.slug,
            teamId: team.slug
          };
          return (
            <div class="box" key={team.slug}>
              <div class="box-header">
                <div class="pull-right actions">
                  <a href="#"><span class="icon-settings"></span> Team Settings</a>
                </div>
                <h3>
                  <Router.Link
                    to="teamDetails"
                    params={teamRouteParams}>{team.name}</Router.Link>
                </h3>
              </div>
              <div class="box-content with-padding">
                <ul class="projects">
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
    );
  }
});

module.exports = OrganizationTeams;
