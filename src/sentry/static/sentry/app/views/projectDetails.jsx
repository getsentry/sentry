import React from "react";
import Reflux from "reflux";
import Router from "react-router";
import api from "../api";
import DocumentTitle from "react-document-title";
import MemberListStore from "../stores/memberListStore";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import MissingProjectMembership from "../components/missingProjectMembership";
import ProjectHeader from "../components/projectHeader";
import OrganizationState from "../mixins/organizationState";
import RouteMixin from "../mixins/routeMixin";
import PropTypes from "../proptypes";
import TeamStore from "../stores/teamStore";

const ERROR_TYPES = {
  MISSING_MEMBERSHIP: "MISSING_MEMBERSHIP",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND"
};

var ProjectDetails = React.createClass({
  mixins: [
    Reflux.connect(MemberListStore, "memberList"),
    Reflux.listenTo(TeamStore, "onTeamChange"),
    OrganizationState,
    Reflux.listenTo(TeamStore, "onTeamChange"),
    RouteMixin
  ],

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
      errorType: null,
      memberList: [],
      project: null,
      team: null,
      projectNavSection: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  routeDidChange(nextPath, nextParams) {
    let router = this.context.router;
    let params = router.getCurrentParams();
    if (nextParams.projectId != params.projectId ||
        nextParams.orgId != params.orgId) {
      this.remountComponent();
    }
  },

  onTeamChange() {
    this.fetchData();
  },

  identifyProject() {
    let router = this.context.router;
    let params = router.getCurrentParams();
    let projectSlug = params.projectId;
    let activeProject = null;
    let activeTeam = null;
    let teams = TeamStore.getAll();
    teams.forEach((team) => {
      team.projects.forEach((project) => {
        if (project.slug == projectSlug) {
          activeProject = project;
          activeTeam = team;
        }
      });
    });
    return [activeTeam, activeProject];
  },

  fetchData() {
    let org = this.context.organization;
    if (!org) {
      return;
    }
    let [activeTeam, activeProject] = this.identifyProject();
    let isMember = activeTeam && activeTeam.isMember;

    if (activeProject && isMember) {
      // TODO(dcramer): move member list to organization level
      api.request(this.getMemberListEndpoint(), {
        success: (data) => {
          MemberListStore.loadInitialData(data);
        }
      });

      this.setState({
        project: activeProject,
        team: activeTeam,
        loading: false,
        error: false,
        errorType: null
      });
    } else if (isMember === false) {
      this.setState({
        project: activeProject,
        team: activeTeam,
        loading: false,
        error: true,
        errorType: ERROR_TYPES.MISSING_MEMBERSHIP
      });
    } else {
      this.setState({
        project: activeProject,
        team: activeTeam,
        loading: false,
        error: true,
        errorType: ERROR_TYPES.PROJECT_NOT_FOUND
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
      return this.state.team.name + ' / ' + this.state.project.name;
    return 'Sentry';
  },

  render() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error) {
      switch (this.state.errorType) {
        case ERROR_TYPES.PROJECT_NOT_FOUND:
          return (
            <div className="container">
              <div className="alert alert-block">The project you were looking for was not found.</div>
            </div>
          );
        case ERROR_TYPES.MISSING_MEMBERSHIP:
          // TODO(dcramer): add various controls to improve this flow and break it
          // out into a reusable missing access error component
          return (
            <MissingProjectMembership
                organization={this.getOrganization()}
                team={this.state.team}
                project={this.state.project} />
          );
        default:
          return <LoadingError onRetry={this.remountComponent} />;
      }
    }

    return (
      <DocumentTitle title={this.getTitle()}>
        <div>
          <ProjectHeader
            activeSection={this.state.projectNavSection}
            project={this.state.project}
            organization={this.getOrganization()} />
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

export default ProjectDetails;
