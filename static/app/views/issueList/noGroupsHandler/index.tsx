import {Component, lazy, Suspense} from 'react';

import type {Client} from 'sentry/api';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {DEFAULT_QUERY} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import NoIssuesMatched from 'sentry/views/issueList/noGroupsHandler/noIssuesMatched';
import {FOR_REVIEW_QUERIES} from 'sentry/views/issueList/utils';

import NoUnresolvedIssues from './noUnresolvedIssues';

const WaitingForEvents = lazy(() => import('sentry/components/waitingForEvents'));
const UpdatedEmptyState = lazy(() => import('sentry/components/updatedEmptyState'));

type Props = {
  api: Client;
  groupIds: string[];
  organization: Organization;
  query: string;
  emptyMessage?: React.ReactNode;
  selectedProjectIds?: number[];
};

type State = {
  fetchingSentFirstEvent: boolean;
  firstEventProjects?: Project[] | null;
  sentFirstEvent?: boolean;
};

/**
 * Component which is rendered when no groups/issues were found. This could
 * either be caused by having no first events, having resolved all issues, or
 * having no issues be returned from a query. This component will conditionally
 * render one of those states.
 */
class NoGroupsHandler extends Component<Props, State> {
  state: State = {
    fetchingSentFirstEvent: true,
    sentFirstEvent: false,
    firstEventProjects: null,
  };

  componentDidMount() {
    this.fetchSentFirstEvent();
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  /**
   * This is a bit hacky, but this is causing flakiness in frontend tests
   * `issueList/overview` is being unmounted during tests before the requests
   * in `this.fetchSentFirstEvent` are completed and causing this React warning:
   *
   * Warning: Can't perform a React state update on an unmounted component.
   * This is a no-op, but it indicates a memory leak in your application.
   * To fix, cancel all subscriptions and asynchronous tasks in the
   * componentWillUnmount method.
   *
   * This is something to revisit if we refactor API client
   */
  private _isMounted = false;

  async fetchSentFirstEvent() {
    this.setState({
      fetchingSentFirstEvent: true,
    });

    const {organization, selectedProjectIds, api} = this.props;
    let sentFirstEvent = false;
    let projects = [];

    // If no projects are selected, then we must check every project the user is a
    // member of and make sure there are no first events for all of the projects
    // Set project to -1 for all projects
    // Do not pass a project id for "my projects"
    let firstEventQuery: {project?: number[]} = {};
    const projectsQuery: {per_page: number; query?: string} = {per_page: 1};

    if (selectedProjectIds?.length && !selectedProjectIds.includes(-1)) {
      firstEventQuery = {project: selectedProjectIds};
      projectsQuery.query = selectedProjectIds.map(id => `id:${id}`).join(' ');
    }

    try {
      [{sentFirstEvent}, projects] = await Promise.all([
        // checks to see if selection has sent a first event
        api.requestPromise(`/organizations/${organization.slug}/sent-first-event/`, {
          query: firstEventQuery,
        }),
        // retrieves a single project to feed to WaitingForEvents from renderStreamBody
        api.requestPromise(`/organizations/${organization.slug}/projects/`, {
          query: projectsQuery,
        }),
      ]);
    } catch {
      this.setState({
        fetchingSentFirstEvent: false,
        sentFirstEvent: true,
        firstEventProjects: undefined,
      });
      return;
    }

    // See comment where this property is initialized
    // FIXME
    if (!this._isMounted) {
      return;
    }

    this.setState({
      fetchingSentFirstEvent: false,
      sentFirstEvent,
      firstEventProjects: projects,
    });
  }

  renderLoading() {
    return <LoadingIndicator />;
  }

  renderAwaitingEvents(projects: State['firstEventProjects']) {
    const {organization, groupIds} = this.props;
    const project = projects && projects.length > 0 ? projects[0] : undefined;
    const sampleIssueId = groupIds.length > 0 ? groupIds[0] : undefined;

    const updatedEmptyStatePlatforms = [
      'python-django',
      'node',
      'javascript-nextjs',
      'android',
      ...(organization.features.includes('issue-stream-empty-state-additional-platforms')
        ? [
            'apple-ios',
            'dotnet',
            'dotnet-aspnetcore',
            'flutter',
            'go',
            'java',
            'java-spring-boot',
            'javascript',
            'javascript-angular',
            'javascript-react',
            'javascript-vue',
            'node-express',
            'node-nestjs',
            'php',
            'php-laravel',
            'python',
            'python-fastapi',
            'python-flask',
            'react-native',
            'ruby',
            'ruby-rails',
            'unity',
          ]
        : []),
    ];

    const hasUpdatedEmptyState =
      organization.features.includes('issue-stream-empty-state') &&
      project?.platform &&
      updatedEmptyStatePlatforms.includes(project.platform);

    return (
      <Suspense fallback={<Placeholder height="260px" />}>
        {!hasUpdatedEmptyState && (
          <WaitingForEvents
            org={organization}
            project={project}
            sampleIssueId={sampleIssueId}
          />
        )}
        {hasUpdatedEmptyState && <UpdatedEmptyState project={project} />}
      </Suspense>
    );
  }

  renderEmpty() {
    const {emptyMessage} = this.props;
    if (emptyMessage) {
      return (
        <EmptyStateWarning>
          <p>{emptyMessage}</p>
        </EmptyStateWarning>
      );
    }
    return <NoIssuesMatched />;
  }

  render() {
    const {fetchingSentFirstEvent, sentFirstEvent, firstEventProjects} = this.state;
    const {query} = this.props;

    if (fetchingSentFirstEvent) {
      return this.renderLoading();
    }
    if (!sentFirstEvent) {
      return this.renderAwaitingEvents(firstEventProjects);
    }
    if (query === DEFAULT_QUERY) {
      return (
        <NoUnresolvedIssues
          title={t("We couldn't find any issues that matched your filters.")}
          subtitle={t('Get out there and write some broken code!')}
        />
      );
    }

    if (FOR_REVIEW_QUERIES.includes(query || '')) {
      return (
        <NoUnresolvedIssues
          title={t('Well, would you look at that.')}
          subtitle={t(
            'No more issues to review. Better get back out there and write some broken code.'
          )}
        />
      );
    }

    return this.renderEmpty();
  }
}

export default NoGroupsHandler;
