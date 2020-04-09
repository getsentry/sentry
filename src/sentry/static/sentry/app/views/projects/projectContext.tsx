import DocumentTitle from 'react-document-title';
import React from 'react';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import {fetchOrgMembers} from 'app/actionCreators/members';
import {setActiveProject} from 'app/actionCreators/projects';
import {t} from 'app/locale';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import MissingProjectMembership from 'app/components/projects/missingProjectMembership';
import Projects from 'app/utils/projects';
import SentryTypes from 'app/sentryTypes';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

const ERROR_TYPES = {
  MISSING_MEMBERSHIP: 'MISSING_MEMBERSHIP',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
} as const;

type Props = {
  api: Client;

  /**
   * If true, this will not change `state.loading` during `fetchData` phase
   */
  skipReload: boolean;
  organization: Organization;
  projectId: string;
  orgId: string;
  project: Project;
};

type State = {
  loading: boolean;
  error: boolean;
  errorType: null | typeof ERROR_TYPES[keyof typeof ERROR_TYPES];
};

/**
 * Higher-order component that sets `project` as a child context
 * value to be accessed by child elements.
 *
 * Additionally delays rendering of children until project XHR has finished
 * and context is populated.
 */
class ProjectContext extends React.Component<Props, State> {
  static childContextTypes = {
    project: SentryTypes.Project,
  };

  state = {
    loading: false,
    error: false,
    errorType: null,
  };

  getChildContext() {
    return {
      project: this.props.project,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  remountComponent() {
    this.fetchData();
  }

  getTitle() {
    return this.props.project.slug;
  }

  async fetchData() {
    const {orgId, projectId, skipReload} = this.props;
    // we fetch core access/information from the global organization data
    const activeProject = this.props.project;
    const hasAccess = activeProject && activeProject.hasAccess;

    this.setState(state => ({
      // if `skipReload` is true, then don't change loading state
      loading: skipReload ? state.loading : true,
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

    // TODO: DO we need this?
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
  }

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
              project={this.props.project}
              organization={this.props.organization}
              projectId={this.props.project.slug}
            />
          );
        default:
          return <LoadingError onRetry={this.remountComponent} />;
      }
    }

    return this.props.children;
  }

  render() {
    return <DocumentTitle title={this.getTitle()}>{this.renderBody()}</DocumentTitle>;
  }
}

function ProjectContextContainer({orgId, projectId, ...props}: Props) {
  return (
    <Projects key={`${orgId}-${projectId}`} orgId={orgId} slugs={[projectId]}>
      {({projects, initiallyLoaded, fetching}) => {
        return (
          <React.Fragment>
            {!initiallyLoaded || fetching ? (
              <LoadingIndicator />
            ) : (
              <ProjectContext
                {...props}
                orgId={orgId}
                projectId={projectId}
                project={projects[0]}
              />
            )}
          </React.Fragment>
        );
      }}
    </Projects>
  );
}
export {ProjectContext};

export default withApi(withOrganization(ProjectContextContainer));
