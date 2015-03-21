/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var MemberListStore = require("../stores/memberListStore");
var LoadingIndicator = require("../components/loadingIndicator");
var ProjectHeader = require("../components/projectHeader");
var OrganizationState = require("../mixins/organizationState");
var RouteMixin = require("../mixins/routeMixin");
var PropTypes = require("../proptypes");

var ProjectDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Reflux.connect(MemberListStore, "memberList"),
    OrganizationState,
    RouteMixin,
    Router.State
  ],

  crumbReservations: 2,

  childContextTypes: {
    project: PropTypes.Project,
    team: PropTypes.Team
  },

  getChildContext() {
    return {
      project: this.state.project,
      team: this.state.team
    };
  },

  getInitialState() {
    return {
      memberList: [],
      project: null,
      team: null,
      projectNavSection: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  routeDidChange(nextPath, nextParams) {
    if (nextParams.projectId != this.getParams().projectId ||
        nextParams.orgId != this.getParams().orgId) {
      this.fetchData();
    }
  },

  fetchData() {
    var org = this.getOrganization();
    if (!org) {
      return;
    }

    var projectSlug = this.getParams().projectId;
    var activeProject;
    var activeTeam;
    org.teams.forEach((team) => {
      team.projects.forEach((project) => {
        if (project.slug == projectSlug) {
          activeProject = project;
          activeTeam = team;
        }
      });
    });

    this.setState({
      team: activeTeam,
      project: activeProject,
      loading: false,
      error: typeof activeProject !== "undefined"
    });

    if (typeof activeProject !== "undefined") {
      api.request(this.getMemberListEndpoint(), {
        success: (data) => {
          MemberListStore.loadInitialData(data);
        }
      });

      this.setBreadcrumbs([
        {name: activeTeam.name, to: "teamDetails", params: {
          orgId: org.slug,
          teamId: activeTeam.slug
        }},
        {name: activeProject.name, to: "projectDetails"}
      ]);
    }
  },

  getMemberListEndpoint() {
    var params = this.getParams();
    return '/projects/' + params.orgId + '/' + params.projectId + '/members/';
  },

  setProjectNavSection(section) {
    this.setState({
      projectNavSection: section
    });
  },

  render() {
    if (!this.state.project) {
      return <LoadingIndicator />;
    }
    return (
      <div>
        <ProjectHeader activeSection={this.state.projectNavSection} />
        <div className="container">
          <div className="content">
            <Router.RouteHandler
                memberList={this.state.memberList}
                setProjectNavSection={this.setProjectNavSection}
                {...this.props} />
          </div>
        </div>
      </div>
    );
  }
});

module.exports = ProjectDetails;
