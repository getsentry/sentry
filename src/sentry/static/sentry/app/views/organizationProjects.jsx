/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var AppState = require("../mixins/appState");
var BarChart = require("../components/barChart");
var TeamStore = require("../stores/teamStore");
var OrganizationHomeContainer = require("../components/organizationHomeContainer");
var OrganizationState = require("../mixins/organizationState");

var OrganizationProjects = React.createClass({
  mixins: [
    AppState,
    OrganizationState,
    Reflux.listenTo(TeamStore, "onTeamListChange")
  ],

  contextTypes: {
    router: React.PropTypes.func
  },

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

  getOrganizationStatsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return '/organizations/' + params.orgId + '/stats/';
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

  componentWillMount() {
    this.fetchStats();
  },

  render() {
    var org = this.getOrganization();
    var projectStats = this.state.projectStats;

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
                var chartData = null;
                if (projectStats) {
                  chartData = projectStats[project.id].map((point) => {
                    return {x: point[0], y: point[1]};
                  });
                }
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
                      {chartData &&
                        <BarChart points={chartData} className="sparkline" />
                      }
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
