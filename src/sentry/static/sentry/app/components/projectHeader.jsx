var React = require("react");
var Router = require("react-router");

var AppState = require("../mixins/appState");
var ConfigStore = require("../stores/configStore");
var DropdownLink = require("../components/dropdownLink");
var MenuItem = require("../components/menuItem");
var {escape} = require("../utils");

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

  highlight(text, highlightText) {
    if (!highlightText) {
      return text;
    }
    highlightText = highlightText.toLowerCase();
    var idx = text.toLowerCase().indexOf(highlightText);
    if (idx === -1) {
      return text;
    }
    return (
      <span>
        {text.substr(0, idx)}
        <strong class="highlight">
          {text.substr(idx, highlightText.length)}
        </strong>
        {text.substr(idx + highlightText.length)}
      </span>
    );
  },

  getProjectNode(team, project, highlightText) {
    var org = this.props.organization;
    var projectRouteParams = {
      orgId: org.slug,
      projectId: project.slug
    };

    return (
      <MenuItem key={project.slug} to="projectDetails"
            params={projectRouteParams}>
        {this.highlight(project.name, highlightText)}
      </MenuItem>
    );
  },

  onOpen(event) {
    $(this.refs.filter.getDOMNode()).focus();
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
    var filter = this.state.filter;
    var urlPrefix = ConfigStore.get('urlPrefix');
    var children = [];
    var activeTeam;
    var activeProject;
    var projectRouteParams = {
      orgId: org.slug,
      projectId: projectId
    };

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
        if (filter && fullName.indexOf(filter) === -1) {
          return;
        }
        if (!hasTeam) {
          children.push((
            <li className="team-name" key={'_team' + team.slug}>
              {this.highlight(team.name, this.state.filter)}
            </li>
          ));
          hasTeam = true;
        }
        children.push(this.getProjectNode(team, project, this.state.filter));
      });
    });

    return (
      <div>
        <Router.Link to="stream" params={projectRouteParams}>{activeTeam.name} / {activeProject.name}</Router.Link>
        <DropdownLink title="" topLevelClasses="project-dropdown"
            onOpen={this.onOpen} onClose={this.onClose}>
          <li className="project-filter" key="_filter">
            <input type="text" placeholder="Filter projects"
                   onKeyUp={this.onFilterChange} ref="filter" />
          </li>
          {children}
        </DropdownLink>
      </div>
    );
  }
});

var ProjectHeader = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  render() {
    var routeParams = this.context.router.getCurrentParams();
    var navSection = this.props.activeSection;
    var urlPrefix = ConfigStore.get('urlPrefix');
    var user = ConfigStore.get('user');
    var project = this.props.project;
    var org = this.props.organization;

    return (
      <div>
        <div className="sub-header">
          <div className="container">
            <div className="pull-right">
              <ul className="nav nav-tabs">
                <li className={navSection == 'dashboard' ? 'active': ''}>
                  <Router.Link to="projectDashboard" params={routeParams}>
                    Dashboard
                  </Router.Link>
                </li>
                <li className={navSection == 'stream' ? 'active': ''}>
                  <Router.Link to="stream" params={routeParams}>
                    Stream
                  </Router.Link>
                </li>
                <li className={navSection == 'events' ? 'active': ''}>
                  <Router.Link to="projectEvents" params={routeParams}>
                    Events
                  </Router.Link>
                </li>
                <li className={navSection == 'releases' ? 'active': ''}>
                  <Router.Link to="projectReleases" params={routeParams}>
                    Releases
                  </Router.Link>
                </li>
                <li className={navSection == 'settings' ? 'active': ''}>
                  <a href={urlPrefix + '/' + routeParams.orgId + '/' + routeParams.projectId + '/settings/'}>
                    Settings
                  </a>
                </li>
              </ul>
            </div>
            <ul className="breadcrumb">
              <li>
                <Router.Link to="organizationDetails" params={{orgId: org.slug}}>
                  {org.name}
                </Router.Link>
              </li>
              <li>
                <ProjectSelector
                    organization={org}
                    projectId={project.slug}
                    router={this.context.router} />
              </li>
            </ul>
           </div>
        </div>
      </div>
    );
  }
});

module.exports = ProjectHeader;
