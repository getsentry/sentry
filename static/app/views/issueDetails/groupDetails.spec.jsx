import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueCategory} from 'sentry/types';
import GroupDetails from 'sentry/views/issueDetails';

jest.unmock('sentry/utils/recreateRoute');

const SAMPLE_EVENT_ALERT_TEXT =
  'You are viewing a sample error. Configure Sentry to start viewing real errors.';

describe('groupDetails', () => {
  const group = TestStubs.Group({issueCategory: IssueCategory.ERROR});
  const event = TestStubs.Event();
  const project = TestStubs.Project({teams: [TestStubs.Team()]});

  const routes = [
    {path: '/', childRoutes: [], component: null},
    {childRoutes: [], component: null},
    {
      path: '/organizations/:orgId/issues/:groupId/',
      indexRoute: null,
      childRoutes: [],
      componentPromise: () => {},
      component: null,
    },
    {
      componentPromise: null,
      component: null,
    },
  ];

  const initRouter = {
    location: {
      pathname: `/organizations/org-slug/issues/${group.id}/`,
      query: {},
      search: '?foo=bar',
      hash: '#hash',
    },
    params: {
      groupId: group.id,
    },
    routes,
  };

  const defaultInit = initializeOrg({
    project,
    router: initRouter,
  });

  function MockComponent({group: groupProp, environments, eventError}) {
    return (
      <div>
        Group Details Mock
        <div>title: {groupProp.title}</div>
        <div>environment: {environments.join(' ')}</div>
        {eventError && <div>eventError</div>}
      </div>
    );
  }

  const createWrapper = (init = defaultInit) => {
    return render(
      <GroupDetails
        {...init.router}
        router={init.router}
        organization={init.organization}
      >
        <MockComponent />
      </GroupDetails>,
      {context: init.routerContext, organization: init.organization, router: init.router}
    );
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    OrganizationStore.onUpdate(defaultInit.organization);
    act(() => ProjectsStore.loadInitialData(defaultInit.organization.projects));

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: {...group},
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/events/latest/`,
      statusCode: 200,
      body: {
        ...event,
      },
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/issues/`,
      method: 'PUT',
      body: {
        hasSeen: false,
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [project],
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/first-last-release/`,
      method: 'GET',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/events/`,
      statusCode: 200,
      body: {
        data: [
          {
            'count()': 1,
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/environments/`,
      body: TestStubs.Environments(),
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/tags/`,
      body: [],
    });
  });

  afterEach(() => {
    act(() => ProjectsStore.reset());
    GroupStore.reset();
    PageFiltersStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('renders', async function () {
    act(() => ProjectsStore.reset());
    createWrapper();

    expect(screen.queryByText(group.title)).not.toBeInTheDocument();

    act(() => ProjectsStore.loadInitialData(defaultInit.organization.projects));

    expect(await screen.findByText(group.title, {exact: false})).toBeInTheDocument();

    // Sample event alert should not show up
    expect(screen.queryByText(SAMPLE_EVENT_ALERT_TEXT)).not.toBeInTheDocument();
  });

  it('renders error when issue is not found', async function () {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      statusCode: 404,
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/events/latest/`,
      statusCode: 404,
    });

    createWrapper();

    await waitFor(() =>
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    );

    expect(
      await screen.findByText('The issue you were looking for was not found.')
    ).toBeInTheDocument();
  });

  it('renders MissingProjectMembership when trying to access issue in project the user does not belong to', async function () {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      statusCode: 403,
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/events/latest/`,
      statusCode: 403,
    });

    createWrapper();

    await waitFor(() =>
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    );

    expect(
      await screen.findByText(
        'No teams have access to this project yet. Ask an admin to add your team to this project.'
      )
    ).toBeInTheDocument();
  });

  it('fetches issue details for a given environment', async function () {
    const init = initializeOrg({
      router: {
        ...initRouter,
        location: TestStubs.location({
          ...initRouter.location,
          query: {environment: 'staging'},
        }),
      },
    });
    createWrapper({router: init.router});

    await waitFor(() =>
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    );

    expect(await screen.findByText('environment: staging')).toBeInTheDocument();
  });

  /**
   * This is legacy code that I'm not even sure still happens
   */
  it('redirects to new issue if params id !== id returned from API request', async function () {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: {...group, id: 'new-id'},
    });
    createWrapper();
    expect(screen.queryByText('Group Details Mock')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(browserHistory.push).toHaveBeenCalledTimes(1);
    });
    expect(browserHistory.push).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/new-id/?foo=bar#hash'
    );
  });

  it('renders issue event error', async function () {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/events/latest/`,
      statusCode: 404,
    });
    createWrapper();
    expect(await screen.findByText('eventError')).toBeInTheDocument();
  });

  it('renders for review reason', async function () {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: {
        ...group,
        inbox: {
          date_added: '2020-11-24T13:17:42.248751Z',
          reason: 0,
          reason_details: null,
        },
      },
    });
    createWrapper();
    expect(await screen.findByText('New Issue')).toBeInTheDocument();
  });

  it('renders substatus badge', async function () {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: {
        ...group,
        inbox: null,
        status: 'unresolved',
        substatus: 'ongoing',
      },
    });
    createWrapper({
      ...defaultInit,
      organization: {...defaultInit.organization, features: ['escalating-issues-ui']},
    });
    expect(await screen.findByText('Ongoing')).toBeInTheDocument();
  });

  it('renders alert for sample event', async function () {
    const sampleGroup = TestStubs.Group({issueCategory: IssueCategory.ERROR});
    sampleGroup.tags.push({key: 'sample_event'});
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/tags/`,
      body: [{key: 'sample_event'}],
    });

    createWrapper();

    expect(await screen.findByText(SAMPLE_EVENT_ALERT_TEXT)).toBeInTheDocument();
  });

  it('renders error when project does not exist', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/other-project-slug/issues/`,
      method: 'PUT',
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: {...group, project: {slug: 'other-project-slug'}},
    });

    createWrapper();

    expect(
      await screen.findByText('The project other-project-slug does not exist')
    ).toBeInTheDocument();
  });
});
