import {Component, createContext} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {setActiveProject} from 'sentry/actionCreators/projects';
import type {Client} from 'sentry/api';
import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MissingProjectMembership from 'sentry/components/projects/missingProjectMembership';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {User} from 'sentry/types/user';
import {
  addProjectFeaturesHandler,
  buildSentryFeaturesHandler,
} from 'sentry/utils/featureFlags';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';
import withProjects from 'sentry/utils/withProjects';

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
  children: ((props: ChildFuncProps) => React.ReactNode) | React.ReactNode;
  loadingProjects: boolean;
  organization: Organization;
  projectSlug: string;
  projects: Project[];
  /**
   * If true, this will not change `state.loading` during `fetchData` phase
   */
  skipReload?: boolean;
};

type State = {
  error: boolean;
  errorType: ErrorTypes | null;
  loading: boolean;
  memberList: User[];
  project: Project | null;
};

const ProjectContext = createContext<Project | null>(null);

/**
 * Higher-order component that sets `project` as a child context
 * value to be accessed by child elements.
 *
 * Additionally delays rendering of children until project XHR has finished
 * and context is populated.
 */
class ProjectContextProvider extends Component<Props, State> {
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

  componentDidMount() {
    // Wait for withProjects to fetch projects before making request
    // Once loaded we can fetchData in componentDidUpdate
    const {loadingProjects} = this.props;
    if (!loadingProjects) {
      this.fetchData();
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (nextProps.projectSlug === this.props.projectSlug) {
      return;
    }

    if (!nextProps.skipReload) {
      this.remountComponent();
    }
  }

  componentDidUpdate(prevProps: Props, _prevState: State) {
    if (prevProps.projectSlug !== this.props.projectSlug) {
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
  }

  componentWillUnmount() {
    this.unsubscribeMembers();
    this.unsubscribeProjects();
  }

  unsubscribeProjects = ProjectsStore.listen(
    (projectIds: Set<string>) => this.onProjectChange(projectIds),
    undefined
  );

  unsubscribeMembers = MemberListStore.listen(
    ({members}: typeof MemberListStore.state) => this.setState({memberList: members}),
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
    const {projects, projectSlug} = this.props;
    return projects.find(({slug}) => slug === projectSlug) || null;
  }

  async fetchData() {
    const {organization, projectSlug, skipReload} = this.props;
    // we fetch core access/information from the global organization data
    const activeProject = this.identifyProject();
    const hasAccess = activeProject?.hasAccess;

    this.setState((state: State) => ({
      // if `skipReload` is true, then don't change loading state
      loading: skipReload ? state.loading : true,
      // we bind project initially, but it'll rebind
      project: activeProject,
    }));

    if (activeProject && hasAccess) {
      setActiveProject(null);
      const projectRequest = this.props.api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/`
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
        addProjectFeaturesHandler({
          project,
          handler: buildSentryFeaturesHandler('feature.projects:'),
        });
      } catch (error) {
        this.setState({
          loading: false,
          error: false,
          errorType: ErrorTypes.UNKNOWN,
        });
      }

      fetchOrgMembers(this.props.api, organization.slug, [activeProject.id]);

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
      await this.props.api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/`
      );
    } catch (error) {
      this.setState({
        loading: false,
        error: true,
        errorType: ErrorTypes.PROJECT_NOT_FOUND,
      });
    }
  }

  renderBody() {
    const {children, organization} = this.props;
    const {error, errorType, loading, project} = this.state;

    if (loading) {
      return (
        <div className="loading-full-layout">
          <LoadingIndicator />
        </div>
      );
    }

    if (!error && project) {
      return (
        <ProjectContext.Provider value={project}>
          {typeof children === 'function' ? children({project}) : children}
        </ProjectContext.Provider>
      );
    }

    switch (errorType) {
      case ErrorTypes.PROJECT_NOT_FOUND:
        // TODO(chrissy): use scale for margin values
        return (
          <Layout.Page withPadding>
            <Alert.Container>
              <Alert type="warning">
                {t('The project you were looking for was not found.')}
              </Alert>
            </Alert.Container>
          </Layout.Page>
        );
      case ErrorTypes.MISSING_MEMBERSHIP:
        // TODO(dcramer): add various controls to improve this flow and break it
        // out into a reusable missing access error component
        return (
          <ErrorWrapper>
            <MissingProjectMembership organization={organization} project={project} />
          </ErrorWrapper>
        );
      default:
        return <LoadingError onRetry={this.remountComponent} />;
    }
  }

  render() {
    return (
      <SentryDocumentTitle noSuffix title={this.getTitle()}>
        {this.renderBody()}
      </SentryDocumentTitle>
    );
  }
}

export {ProjectContext, ProjectContextProvider};

export default withApi(withOrganization(withProjects(ProjectContextProvider)));

const ErrorWrapper = styled('div')`
  width: 100%;
  margin: ${space(2)} ${space(4)};
`;
