import {Component, createRef} from 'react';
import DocumentTitle from 'react-document-title';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'app/actionCreators/members';
import {setActiveProject} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import MissingProjectMembership from 'app/components/projects/missingProjectMembership';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import MemberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';
import space from 'app/styles/space';
import {Organization, Project, User} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withProjects from 'app/utils/withProjects';

enum ErrorTypes {
  MISSING_MEMBERSHIP = 'MISSING_MEMBERSHIP',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  UNKNOWN = 'UNKNOWN',
}

type ChildFuncProps = {
  project: Project;
};

type Props = {
  api: Client;
  /**
   * If true, this will not change `state.loading` during `fetchData` phase
   */
  skipReload?: boolean;
  organization: Organization;
  projects: Project[];
  projectId: string;
  orgId: string;
  children: ((props: ChildFuncProps) => React.ReactNode) | React.ReactNode;
};

type State = {
  memberList: User[];
  project: Project | null;
  loading: boolean;
  error: boolean;
  errorType: ErrorTypes | null;
};

/**
 * Higher-order component that sets `project` as a child context
 * value to be accessed by child elements.
 *
 * Additionally delays rendering of children until project XHR has finished
 * and context is populated.
 */
class ProjectContext extends Component<Props, State> {
  static childContextTypes = {
    project: SentryTypes.Project,
  };

  state = this.getInitialState();

  getInitialState(): State {
    return {
      loading: true,
      error: false,
      errorType: null,
      memberList: [],
      project: null,
    };
  }

  getChildContext() {
    return {
      project: this.state.project,
    };
  }

  componentWillMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.projectId === this.props.projectId) {
      return;
    }

    if (!nextProps.skipReload) {
      this.remountComponent();
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
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
    if (prevState.project !== this.state.project) {
      const docTitle = this.docTitleRef.current;
      if (!docTitle) {
        return;
      }
      docTitle.forceUpdate();
    }
  }

  componentWillUnmount() {
    this.unsubscribeMembers();
    this.unsubscribeProjects();
  }

  docTitleRef = createRef<DocumentTitle>();

  unsubscribeProjects = ProjectsStore.listen(
    (projectIds: Set<string>) => this.onProjectChange(projectIds),
    undefined
  );

  unsubscribeMembers = MemberListStore.listen(
    (memberList: MemberListStore['state']) => this.setState({memberList}),
    undefined
  );

  remountComponent() {
    this.setState(this.getInitialState());
  }

  getTitle() {
    return this.state.project?.slug ?? 'Sentry';
  }

  onProjectChange(projectIds: Set<string>) {
    if (!this.state.project) {
      return;
    }
    if (!projectIds.has(this.state.project.id)) {
      return;
    }
    this.setState({
      project: {...ProjectsStore.getById(this.state.project.id)} as Project,
    });
  }

  identifyProject() {
    const {projects, projectId} = this.props;
    const projectSlug = projectId;
    return projects.find(({slug}) => slug === projectSlug) || null;
  }

  async fetchData() {
    const {orgId, projectId, skipReload} = this.props;
    // we fetch core access/information from the global organization data
    const activeProject = this.identifyProject();
    const hasAccess = activeProject && activeProject.hasAccess;

    this.setState((state: State) => ({
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
          errorType: ErrorTypes.UNKNOWN,
        });
      }

      fetchOrgMembers(this.props.api, orgId, [activeProject.id]);

      return;
    }

    // User is not a memberof the active project
    if (activeProject && !activeProject.isMember) {
      this.setState({
        loading: false,
        error: true,
        errorType: ErrorTypes.MISSING_MEMBERSHIP,
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
        errorType: ErrorTypes.PROJECT_NOT_FOUND,
      });
    }
  }

  renderBody() {
    const {error, errorType, loading, project} = this.state;
    if (loading) {
      return (
        <div className="loading-full-layout">
          <LoadingIndicator />
        </div>
      );
    }

    if (!error && project) {
      const {children} = this.props;

      return typeof children === 'function' ? children({project}) : children;
    }

    switch (errorType) {
      case ErrorTypes.PROJECT_NOT_FOUND:
        // TODO(chrissy): use scale for margin values
        return (
          <div className="container">
            <div className="alert alert-block" style={{margin: '30px 0 10px'}}>
              {t('The project you were looking for was not found.')}
            </div>
          </div>
        );
      case ErrorTypes.MISSING_MEMBERSHIP:
        // TODO(dcramer): add various controls to improve this flow and break it
        // out into a reusable missing access error component
        return (
          <ErrorWrapper>
            <MissingProjectMembership
              organization={this.props.organization}
              projectSlug={project?.slug}
            />
          </ErrorWrapper>
        );
      default:
        return <LoadingError onRetry={this.remountComponent} />;
    }
  }

  render() {
    return (
      <DocumentTitle ref={this.docTitleRef} title={this.getTitle()}>
        {this.renderBody()}
      </DocumentTitle>
    );
  }
}

export {ProjectContext};

export default withApi(withOrganization(withProjects(ProjectContext)));

const ErrorWrapper = styled('div')`
  width: 100%;
  margin: ${space(2)} ${space(4)};
`;
