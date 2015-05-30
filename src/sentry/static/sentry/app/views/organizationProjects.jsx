/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var AppState = require("../mixins/appState");
var TeamStore = require("../stores/teamStore");
var OrganizationHomeContainer = require("../components/organizationHomeContainer");
var OrganizationState = require("../mixins/organizationState");

var OrganizationProjects = React.createClass({
  mixins: [
    AppState,
    OrganizationState,
    Reflux.listenTo(TeamStore, "onTeamListChange")
  ],

  getInitialState() {
    return {
      projectList: this.getProjectList()
    };
  },

  onTeamListChange() {
    this.setState({
      projectList: this.getProjectList()
    });
  },

  getProjectList() {
    var activeTeams = TeamStore.getActive();
    var projectList = [];
    activeTeams.forEach((team) => {
      team.projects.forEach((project) => {
        projectList.push([team, project]);
      });
    });
    return projectList;
  },

  render() {
    var org = this.getOrganization();

    return (
      <OrganizationHomeContainer>
        <div>
          <h3>My Projects</h3>
          <table className="table my-projects">
            <tbody>
              {this.state.projectList.map((item) => {
                var team = item[0];
                var project = item[1];
                var projectRouteParams = {
                  orgId: org.slug,
                  projectId: project.slug
                };
                return (
                  <tr>
                    <td>
                      <Router.Link
                          to="projectDetails"
                          params={projectRouteParams}>
                        {team.name} / {project.name}
                      </Router.Link>
                    </td>
                    <td className="align-right">
                      (graph)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </OrganizationHomeContainer>
    );
  }
});

module.exports = OrganizationProjects;
