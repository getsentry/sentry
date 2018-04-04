import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import {withRouter} from 'react-router';

import ApiMixin from '../../mixins/apiMixin';

import MemberListStore from '../../stores/memberListStore';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import MissingProjectMembership from '../../components/missingProjectMembership';
import OrganizationState from '../../mixins/organizationState';
import SentryTypes from '../../proptypes';
import ProjectsStore from '../../stores/projectsStore';
import recreateRoute from '../../utils/recreateRoute';
import {loadEnvironments} from '../../actionCreators/environments';
import {setActiveProject} from '../../actionCreators/projects';
import {t} from '../../locale';

const ERROR_TYPES = {
  MISSING_MEMBERSHIP: 'MISSING_MEMBERSHIP',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Higher-order component that sets `project` as a child context
 * value to be accessed by child elements.
 *
 * Additionally delays rendering of children until project XHR has finished
 * and context is populated.
 */
const ProjectContext = createReactClass({
  displayName: 'ProjectContext',

  propTypes: {
    /**
     * If true, this will not change `state.loading` during `fetchData` phase
     */
    skipReload: PropTypes.bool,
    projectId: PropTypes.string,
    orgId: PropTypes.string,
    location: PropTypes.object,
    router: PropTypes.object,
  },

  childContextTypes: {
    project: SentryTypes.Project,
  },

  mixins: [
    ApiMixin,
    Reflux.connect(MemberListStore, 'memberList'),
    Reflux.listenTo(ProjectsStore, 'onProjectChange'),
    OrganizationState,
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      errorType: null,
      memberList: [],
      project: null,
      projectNavSection: null,
    };
  },

  getChildContext() {
    return {
      project: this.state.project,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.projectId === this.props.projectId) return;

    if (!nextProps.skipReload) {
      this.remountComponent();
    }
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.projectId !== this.props.projectId) {
      this.fetchData();
    }

    // Call forceUpdate() on <DocumentTitle/> if either project or organization
    // state has changed. This is because <DocumentTitle/>'s shouldComponentUpdate()
    // returns false unless props differ; meaning context changes for project/org
    // do NOT trigger renders for <DocumentTitle/> OR any subchildren. The end result
    // being that child elements that listen for context changes on project/org will
    // NOT update (without this hack).
    // See: https://github.com/gaearon/react-document-title/issues/35

    // intentionally shallow comparing references
    if (
      prevState.project !== this.state.project ||
      prevState.organization !== this.state.organization
    ) {
      let docTitle = this.refs.docTitle;
      if (docTitle) docTitle.forceUpdate();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState());
  },

  getTitle() {
    if (this.state.project) return this.state.project.slug;
    return 'Sentry';
  },

  onProjectChange(projectIds) {
    if (!this.state.project) return;
    if (!projectIds.has(this.state.project.id)) return;

    this.setState({
      project: {...ProjectsStore.getById(this.state.project.id)},
    });
  },

  identifyProject() {
    let {projectId} = this.props;
    let projectSlug = projectId;
    let activeProject = null;
    let org = this.context.organization;
    org.projects.forEach(project => {
      if (project.slug == projectSlug) {
        activeProject = project;
      }
    });
    return activeProject;
  },

  fetchData() {
    let {orgId, projectId, location, skipReload} = this.props;
    // we fetch core access/information from the global organization data
    let activeProject = this.identifyProject();
    let hasAccess = activeProject && activeProject.hasAccess;

    this.setState(state => ({
      // if `skipReload` is true, then don't change loading state
      loading: skipReload ? state.loading : true,
      // we bind project initially, but it'll rebind
      project: activeProject,
    }));

    if (activeProject && hasAccess) {
      setActiveProject(null);
      const projectRequest = this.api.requestPromise(`/projects/${orgId}/${projectId}/`);

      const environmentRequest = this.api.requestPromise(
        this.getEnvironmentListEndpoint()
      );

      Promise.all([projectRequest, environmentRequest]).then(
        ([project, envs]) => {
          this.setState({
            loading: false,
            project,
            error: false,
            errorType: null,
          });

          // assuming here that this means the project is considered the active project
          setActiveProject(project);

          // If an environment is specified in the query string, load it instead of default
          const queryEnv = location.query.environment;
          // The default environment cannot be "" (No Environment)
          const {defaultEnvironment} = project;
          const envName = typeof queryEnv === 'undefined' ? defaultEnvironment : queryEnv;
          loadEnvironments(envs, envName);
        },
        () => {
          this.setState({
            loading: false,
            error: false,
            errorType: ERROR_TYPES.UNKNOWN,
          });
        }
      );

      // TODO(dcramer): move member list to organization level
      this.api.request(this.getMemberListEndpoint(), {
        success: data => {
          MemberListStore.loadInitialData(data.filter(m => m.user).map(m => m.user));
        },
      });
    } else if (activeProject && !activeProject.isMember) {
      this.setState({
        loading: false,
        error: true,
        errorType: ERROR_TYPES.MISSING_MEMBERSHIP,
      });
    } else {
      // The project may have been renamed, attempt to lookup the project, if
      // we 301 we will recieve the moved project slug and can update update
      // our route accordingly.
      const lookupHandler = resp => {
        const {status, responseJSON} = resp;

        if (status !== 301 || !responseJSON || !responseJSON.detail) {
          this.setState({
            loading: false,
            error: true,
            errorType: ERROR_TYPES.PROJECT_NOT_FOUND,
          });
          return;
        }

        this.props.router.replace(
          recreateRoute('', {
            ...this.props,
            params: {...this.props.params, projectId: responseJSON.detail.slug},
          })
        );
      };

      // The request ill 404 or 301
      this.api.request(`/projects/${orgId}/${projectId}/`, {error: lookupHandler});
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
      projectNavSection: section,
    });
  },

  renderBody() {
    if (this.state.loading) return <LoadingIndicator />;
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
              projectId={this.state.project.slug}
            />
          );
        default:
          return <LoadingError onRetry={this.remountComponent} />;
      }
    }

    return this.props.children;
  },

  render() {
    return (
      <DocumentTitle ref="docTitle" title={this.getTitle()}>
        {this.renderBody()}
      </DocumentTitle>
    );
  },
});

export {ProjectContext};

export default withRouter(ProjectContext);
