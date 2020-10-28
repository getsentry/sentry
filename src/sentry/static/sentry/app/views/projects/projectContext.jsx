import {withRouter} from 'react-router';
import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {fetchOrgMembers} from 'app/actionCreators/members';
import {setActiveProject} from 'app/actionCreators/projects';
import {t} from 'app/locale';
import withApi from 'app/utils/withApi';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import MemberListStore from 'app/stores/memberListStore';
import MissingProjectMembership from 'app/components/projects/missingProjectMembership';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';
import withProjects from 'app/utils/withProjects';
import withOrganization from 'app/utils/withOrganization';

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
    api: PropTypes.object,

    /**
     * If true, this will not change `state.loading` during `fetchData` phase
     */
    skipReload: PropTypes.bool,
    organization: SentryTypes.Organization,
    projects: PropTypes.arrayOf(SentryTypes.Project),
    projectId: PropTypes.string,
    orgId: PropTypes.string,
  },

  childContextTypes: {
    project: SentryTypes.Project,
  },

  mixins: [
    Reflux.connect(MemberListStore, 'memberList'),
    Reflux.listenTo(ProjectsStore, 'onProjectChange'),
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      errorType: null,
      memberList: [],
      project: null,
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
    if (nextProps.projectId === this.props.projectId) {
      return;
    }

    if (!nextProps.skipReload) {
      this.remountComponent();
    }
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevProps.projectId !== this.props.projectId) {
      this.fetchData();
    }

    // Project list has changed. Likely indicating that a new project has been
    // added. Re-fetch project details in case that the new project is the active
    // project.
    //
    // For now, only compare lengths. It is possible that project slugs within
    // the list could change, but it doesn't seem to be broken anywhere else at
    // the moment that would require deeper checks.
    if (prevProps.projects.length !== this.props.projects.length) {
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
      if (!this.docTitle) {
        return;
      }
      const docTitle = this.docTitleRef.docTitle;
      if (docTitle) {
        docTitle.forceUpdate();
      }
    }
  },

  remountComponent() {
    this.setState(this.getInitialState());
  },

  getTitle() {
    if (this.state.project) {
      return this.state.project.slug;
    }
    return 'Sentry';
  },

  onProjectChange(projectIds) {
    if (!this.state.project) {
      return;
    }
    if (!projectIds.has(this.state.project.id)) {
      return;
    }

    this.setState({
      project: {...ProjectsStore.getById(this.state.project.id)},
    });
  },

  identifyProject() {
    const {projects, projectId} = this.props;
    const projectSlug = projectId;
    return projects.find(({slug}) => slug === projectSlug) || null;
  },

  async fetchData() {
    const {orgId, projectId, skipReload} = this.props;
    // we fetch core access/information from the global organization data
    const activeProject = this.identifyProject();
    const hasAccess = activeProject && activeProject.hasAccess;

    this.setState(state => ({
      // if `skipReload` is true, then don't change loading state
      loading: skipReload ? state.loading : true,
      // we bind project initially, but it'll rebind
      project: activeProject,
    }));

    if (activeProject && hasAccess) {
      setActiveProject(null);
      const projectRequest = this.props.api.requestPromise(
        `/projects/${orgId}/${projectId}/`
      );

      try {
        const project = await projectRequest;
        this.setState({
          loading: false,
          project,
          error: false,
          errorType: null,
        });

        // assuming here that this means the project is considered the active project
        setActiveProject(project);
      } catch (error) {
        this.setState({
          loading: false,
          error: false,
          errorType: ERROR_TYPES.UNKNOWN,
        });
      }

      fetchOrgMembers(this.props.api, orgId, activeProject.id);

      return;
    }

    // User is not a memberof the active project
    if (activeProject && !activeProject.isMember) {
      this.setState({
        loading: false,
        error: true,
        errorType: ERROR_TYPES.MISSING_MEMBERSHIP,
      });

      return;
    }

    // There is no active project. This likely indicates either the project
    // *does not exist* or the project has not yet been added to the store.
    // Either way, make a request to check for existence of the project.
    try {
      await this.props.api.requestPromise(`/projects/${orgId}/${projectId}/`);
    } catch (error) {
      this.setState({
        loading: false,
        error: true,
        errorType: ERROR_TYPES.PROJECT_NOT_FOUND,
      });
    }
  },

  renderBody() {
    if (this.state.loading) {
      return (
        <div className="loading-full-layout">
          <LoadingIndicator />
        </div>
      );
    } else if (this.state.error) {
      switch (this.state.errorType) {
        case ERROR_TYPES.PROJECT_NOT_FOUND:
          // TODO(chrissy): use scale for margin values
          return (
            <div className="container">
              <div className="alert alert-block" style={{margin: '30px 0 10px'}}>
                {t('The project you were looking for was not found.')}
              </div>
            </div>
          );
        case ERROR_TYPES.MISSING_MEMBERSHIP:
          // TODO(dcramer): add various controls to improve this flow and break it
          // out into a reusable missing access error component
          return (
            <MissingProjectMembership
              organization={this.props.organization}
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
      <DocumentTitle ref={ref => (this.docTitleRef = ref)} title={this.getTitle()}>
        {this.renderBody()}
      </DocumentTitle>
    );
  },
});

export {ProjectContext};

export default withApi(withOrganization(withProjects(withRouter(ProjectContext))));
