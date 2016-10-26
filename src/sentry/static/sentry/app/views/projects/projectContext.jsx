import React from 'react';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';

import ApiMixin from '../../mixins/apiMixin';
import EnvironmentStore from '../../stores/environmentStore';
import MemberListStore from '../../stores/memberListStore';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import MissingProjectMembership from '../../components/missingProjectMembership';
import OrganizationState from '../../mixins/organizationState';
import PropTypes from '../../proptypes';
import TeamStore from '../../stores/teamStore';
import ProjectStore from '../../stores/projectStore';
import {t} from '../../locale';

const ERROR_TYPES = {
  MISSING_MEMBERSHIP: 'MISSING_MEMBERSHIP',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND'
};

const ProjectBase = React.createClass({
  propTypes: {
    projectId: React.PropTypes.string,
    orgId: React.PropTypes.string
  },

  childContextTypes: {
    project: PropTypes.Project,
    team: PropTypes.Team
  },

  mixins: [
    ApiMixin,
    Reflux.connect(MemberListStore, 'memberList'),
    Reflux.listenTo(TeamStore, 'onTeamChange'),
    Reflux.listenTo(ProjectStore, 'onProjectChange'),
    OrganizationState
  ],

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

  getChildContext() {
    return {
      project: this.state.project,
      team: this.state.team
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.projectId !== this.props.projectId) {
      this.remountComponent();
    }
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.projectId !== this.props.projectId) {
      this.fetchData();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState());
  },

  getTitle() {
    if (this.state.project)
      return this.state.team.name + ' / ' + this.state.project.name;
    return 'Sentry';
  },

  onTeamChange(itemIds) {
    if (!this.state.team) return;
    if (!itemIds.has(this.state.team.id)) return;

    this.setState({
      team: {...TeamStore.getById(this.state.team.id)}
    });
  },

  onProjectChange(projectIds) {
    if (!this.state.project) return;
    if (!projectIds.has(this.state.project.id)) return;

    this.setState({
      project: {...ProjectStore.getById(this.state.project.id)}
    });
  },

  identifyProject() {
    let {projectId} = this.props;
    let projectSlug = projectId;
    let activeProject = null;
    let activeTeam = null;
    let org = this.context.organization;
    org.teams.forEach((team) => {
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
    let hasAccess = activeTeam && activeTeam.hasAccess;

    this.setState({
      loading: true,
      project: activeProject,
      team: activeTeam
    });

    if (activeProject && hasAccess) {
      // TODO(dcramer): move member list to organization level
      this.api.request(this.getMemberListEndpoint(), {
        success: (data) => {
          MemberListStore.loadInitialData(data.filter((m) => m.user).map((m) => m.user));
        }
      });

      this.api.request(this.getEnvironmentListEndpoint(), {
        success: (data) => {
          EnvironmentStore.loadInitialData(data);
        }
      });

      this.setState({
        loading: false,
        error: false,
        errorType: null
      });
    } else if (activeTeam && activeTeam.isMember) {
      this.setState({
        loading: false,
        error: true,
        errorType: ERROR_TYPES.MISSING_MEMBERSHIP
      });
    } else {
      this.setState({
        loading: false,
        error: true,
        errorType: ERROR_TYPES.PROJECT_NOT_FOUND
      });
    }
  },

  getEnvironmentListEndpoint() {
    let {orgId, projectId} = this.props;
    return `/projects/${orgId}/${projectId}/environments/`;
  },

  getMemberListEndpoint() {
    let {orgId, projectId} = this.props;
    return `/projects/${orgId}/${projectId}/members/`;
  },

  setProjectNavSection(section) {
    this.setState({
      projectNavSection: section
    });
  },

  renderBody() {
    if (this.state.loading)
      return <LoadingIndicator />;
    else if (this.state.error) {
      switch (this.state.errorType) {
        case ERROR_TYPES.PROJECT_NOT_FOUND:
          return (
            <div className="container">
              <div className="alert alert-block">
                {t('The project you were looking for was not found.')}
              </div>
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

    return this.props.children;
  },

  render() {
    return <DocumentTitle title={this.getTitle()}>{this.renderBody()}</DocumentTitle>;
  }
});

export default ProjectBase;
