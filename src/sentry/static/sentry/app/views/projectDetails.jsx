import React from "react";
import Reflux from "reflux";
import Router from "react-router";
import api from "../api";
import ConfigStore from "../stores/configStore";
import DocumentTitle from "react-document-title";
import MemberListStore from "../stores/memberListStore";
import {modelsEqual} from "../utils";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import ProjectHeader from "../components/projectHeader";
import OrganizationState from "../mixins/organizationState";
import RouteMixin from "../mixins/routeMixin";
import PropTypes from "../proptypes";

var ProjectDetails = React.createClass({
  mixins: [
    Reflux.connect(MemberListStore, "memberList"),
    OrganizationState,
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
      return this.state.team.name + ' / ' + this.state.project.name;
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

