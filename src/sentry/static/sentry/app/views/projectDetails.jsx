var React = require("react");
var Reflux = require("reflux");
var Router = require("react-router");

var api = require("../api");
var BreadcrumbMixin = require("../mixins/breadcrumbMixin");
var ConfigStore = require("../stores/configStore");
var DropdownLink = require("../components/dropdownLink");
var DocumentTitle = require("react-document-title");
var MemberListStore = require("../stores/memberListStore");
var MenuItem = require("../components/menuItem");
var {modelsEqual} = require("../utils");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var ProjectHeader = require("../components/projectHeader");
var OrganizationState = require("../mixins/organizationState");
var RouteMixin = require("../mixins/routeMixin");
var PropTypes = require("../proptypes");

var ProjectSelector = React.createClass({
  childContextTypes: {
    router: React.PropTypes.func
  },

  getChildContext() {
    return {
      router: this.props.router
    };
  },

  getInitialState() {
    return {
      filter: ''
    };
  },

  onFilterChange(e) {
    this.setState({
      filter: e.target.value
    });
  },

  getProjectNode(team, project) {
    var org = this.props.organization;
    var projectRouteParams = {
      orgId: org.slug,
      projectId: project.slug
    };
    return (
      <MenuItem key={project.slug} to="projectDetails"
                params={projectRouteParams}>
        {project.name}
      </MenuItem>
    );
  },

  onOpen(event) {
    $(event.target).find('input[type=text]').focus();
  },

  onClose(event) {
    this.setState({
      filter: ''
    });
    $(this.refs.filter.getDOMNode()).val('');
  },

  render() {
    var projectId = this.props.projectId;
    var org = this.props.organization;
    var urlPrefix = ConfigStore.get('urlPrefix');
    var children = [];
    var activeTeam;
    var activeProject;
    org.teams.forEach((team) => {
      if (!team.isMember) {
        return;
      }
      var hasTeam = false;
      team.projects.forEach((project) => {
        if (project.slug == this.props.projectId) {
          activeTeam = team;
          activeProject = project;
        }
        var fullName = team.name + ' ' + project.name + ' ' + team.slug + ' ' + project.slug;
        if (this.state.filter && fullName.indexOf(this.state.filter) === -1) {
          return;
        }
        if (!hasTeam) {
          children.push(<li className="team-name" key={'_team' + team.slug}>{team.name}</li>);
          hasTeam = true;
        }
        children.push(this.getProjectNode(team, project));
      });
    });
    var title = <span>{activeTeam.name} / {activeProject.name}</span>;

    return (
      <DropdownLink title={title} topLevelClasses="project-dropdown"
          onOpen={this.onOpen} onClose={this.onClose}>
        <li className="project-filter" key="_filter">
          <input type="text" placeholder="Filter projects"
                 onKeyUp={this.onFilterChange} ref="filter" />
        </li>
        {children}
        <li className="new-project" key="_new-project">
          <a className="btn btn-primary"
             href={urlPrefix + '/organizations/' + org.slug + '/projects/new/'}>
            <span className="icon-plus" /> Create Project
          </a>
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
      loading: true,
      error: false,
      memberList: [],
      project: null,
      team: null,
      projectNavSection: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps, prevState) {
    var project = this.state.project;
    var org = this.getOrganization();
    this.setBreadcrumbs([
      <ProjectSelector organization={org} projectId={this.state.project.slug}
                       router={this.context.router} />
    ]);
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

    this.setState({
      loading: true,
      error: false
    });

    var router = this.context.router;
    var params = router.getCurrentParams();
    var projectSlug = params.projectId;
    var activeProject = null;
    var activeTeam = null;
    org.teams.forEach((team) => {
      if (!team.isMember) {
        return;
      }
      team.projects.forEach((project) => {
        if (project.slug == projectSlug) {
          activeProject = project;
          activeTeam = team;
        }
      });
    });

    if (activeProject) {
      // TODO(dcramer): move member list to organization level
      api.request(this.getMemberListEndpoint(), {
        success: (data) => {
          MemberListStore.loadInitialData(data);
        }
      });

      this.setState({
        project: activeProject,
        team: activeTeam,
        loading: false
      });
    } else {
      this.setState({
        loading: false,
        error: true
      });
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

  getTitle() {
    if (this.state.project)
      return this.state.team.name + ' / ' + this.state.project.name + ' | Sentry';
    return 'Sentry';
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    return (
      <DocumentTitle title={this.getTitle()}>
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
      </DocumentTitle>
    );
  }
});

module.exports = ProjectDetails;
