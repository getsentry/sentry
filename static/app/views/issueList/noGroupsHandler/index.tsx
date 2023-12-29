import {Component, lazy, Suspense} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';

import campingImg from 'sentry-images/spot/onboarding-preview.svg';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {Client} from 'sentry/api';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {DEFAULT_QUERY} from 'sentry/constants';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {FOR_REVIEW_QUERIES} from 'sentry/views/issueList/utils';

import NoUnresolvedIssues from './noUnresolvedIssues';

type Props = {
  api: Client;
  groupIds: string[];
  organization: Organization;
  query: string;
  router: InjectedRouter;
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
  private _isMounted: boolean = false;

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

    if (selectedProjectIds?.length) {
      firstEventQuery = {project: selectedProjectIds};
      projectsQuery.query = selectedProjectIds.map(id => `id:${id}`).join(' ');
    }

    [{sentFirstEvent}, projects] = await Promise.all([
      // checks to see if selection has sent a first event
      api.requestPromise(`/organizations/${organization.slug}/sent-first-event/`, {
        query: firstEventQuery,
      }),
      // retrieves a single project to feed to the ErrorRobot from renderStreamBody
      api.requestPromise(`/organizations/${organization.slug}/projects/`, {
        query: projectsQuery,
      }),
    ]);

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

    const ErrorRobot = lazy(() => import('sentry/components/errorRobot'));

    return (
      <Suspense fallback={<Placeholder height="260px" />}>
        <ErrorRobot org={organization} project={project} sampleIssueId={sampleIssueId} />
      </Suspense>
    );
  }

  renderEmpty() {
    const {organization, router} = this.props;
    return (
      <Wrapper data-test-id="empty-state" className="empty-state">
        <img src={campingImg} alt="Camping spot illustration" height={200} />
        <MessageContainer>
          <h3>{t('No issues match your search')}</h3>
          <div>{t('If this is unexpected, check out these tips:')}</div>
          <ul>
            <li>{t('Double check your project, environment, and date filters')}</li>
            <li>
              {tct('Make sure your search has the right syntax. [link]', {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/reference/search/">
                    {t('Learn more')}
                  </ExternalLink>
                ),
              })}
            </li>
            <li>
              {tct(
                "Check your [filterSettings: inbound data filter] to make sure the events aren't being filtered out",
                {
                  filterSettings: (
                    <a
                      href="#"
                      onClick={event => {
                        event.preventDefault();
                        const url = `/settings/${organization.slug}/projects/:projectId/filters/data-filters/`;
                        if (router) {
                          navigateTo(url, router);
                        }
                      }}
                    />
                  ),
                }
              )}
            </li>
          </ul>
        </MessageContainer>
      </Wrapper>
    );
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

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
  font-size: ${p => p.theme.fontSizeLarge};
  border-radius: 0 0 3px 3px;
  padding: 40px ${space(3)} ${space(3)};
  min-height: 260px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: center;
    padding: ${space(3)};
    text-align: center;
  }
`;

const MessageContainer = styled('div')`
  align-self: center;
  max-width: 480px;
  margin-left: 40px;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    margin: 0;
  }
`;
