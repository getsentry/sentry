/*** @jsx React.DOM */

var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var DropdownLink = require("../components/dropdownLink");
var MemberListStore = require("../stores/memberListStore");
var MenuItem = require("../components/menuItem");
var LoadingIndicator = require("../components/loadingIndicator");
var ProjectHeader = require("../components/projectHeader");
var OrganizationState = require("../mixins/organizationState");
var RouteMixin = require("../mixins/routeMixin");
var PropTypes = require("../proptypes");

var ProjectSelector = React.createClass({
  render() {
    var projectId = this.props.projectId;
    var org = this.props.organization;
    var projectList = [];
    org.teams.forEach((team) => {
      team.projects.forEach((project) => {
        if (project.slug == this.props.projectId) {
          activeTeam = team;
          activeProject = project;
        }
        projectList.push([team, project]);
      });
    });

    var title = <span>{activeTeam.name} / {activeProject.name}</span>;

    return (
      <DropdownLink title={title} className="project-dropdown">
        <li className="project-filter">
          <input type="text" placeholder="Filter projects" />
        </li>
        <li className="team-name">Captain Planet</li>
        {projectList.map((item) => {
          return (
            <MenuItem key={item[1].slug}>{item[0].name} / {item[1].name}</MenuItem>
          );
        })}
        <li className="new-project">
          <a className="btn btn-primary"><span className="icon-plus"></span> Create Project</a>
        </li>
      </DropdownLink>
    );
  }
});

var ProjectDetails = React.createClass({
  mixins: [
    BreadcrumbMixin,
    Reflux.connect(MemberListStore, "memberList"),
    OrganizationState,
    RouteMixin
  ],

  crumbReservations: 1,

  childContextTypes: {
    project: PropTypes.Project,
    team: PropTypes.Team
  },

  contextTypes: {
    router: React.PropTypes.func
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
    var router = this.context.router;
    var params = router.getCurrentParams();
    if (nextParams.projectId != params.projectId ||
        nextParams.orgId != params.orgId) {
      this.fetchData();
    }
  },

  fetchData() {
    var org = this.getOrganization();
    if (!org) {
      return;
    }

    var router = this.context.router;
    var params = router.getCurrentParams();
    var projectSlug = params.projectId;
    var activeProject;
    org.teams.forEach((team) => {
      team.projects.forEach((project) => {
        if (project.slug == projectSlug) {
          activeProject = project;
        }
      });
    });

    this.setState({
      project: activeProject,
      loading: false,
      error: typeof activeProject !== "undefined"
    });

    if (typeof activeProject !== "undefined") {
      // TODO(dcramer): move member list to organization level
      api.request(this.getMemberListEndpoint(), {
        success: (data) => {
          MemberListStore.loadInitialData(data);
        }
      });

      this.setBreadcrumbs([
        {
          name: <ProjectSelector organization={org} projectId={projectSlug} />
        }
      ]);
    }
  },

  getMemberListEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
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
