import {ConfigFixture} from 'sentry-fixture/config';
import {EnvironmentsFixture} from 'sentry-fixture/environments';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueCategory} from 'sentry/types/group';
import GroupDetails from 'sentry/views/issueDetails/groupDetails';

const SAMPLE_EVENT_ALERT_TEXT =
  'You are viewing a sample error. Configure Sentry to start viewing real errors.';

describe('groupDetails', () => {
  const group = GroupFixture({issueCategory: IssueCategory.ERROR});
  const event = EventFixture();
  const project = ProjectFixture({teams: [TeamFixture()]});

  const routes = [
    {path: '/', childRoutes: []},
    {childRoutes: []},
    {
      path: '/organizations/:orgId/issues/:groupId/',
      childRoutes: [],
    },
    {},
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

  const defaultInit = initializeOrg<{groupId: string}>({
    router: initRouter,
  });

  const recommendedUser = UserFixture({
    options: {
      ...UserFixture().options,
      defaultIssueEvent: 'recommended',
    },
  });
  const latestUser = UserFixture({
    options: {
      ...UserFixture().options,
      defaultIssueEvent: 'latest',
    },
  });
  const oldestUser = UserFixture({
    options: {
      ...UserFixture().options,
      defaultIssueEvent: 'oldest',
    },
  });

  function MockComponent() {
    return <div>Group Details Mock</div>;
  }

  const createWrapper = (init = defaultInit) => {
    return render(
      <GroupDetails {...init.routerProps}>
        <MockComponent />
      </GroupDetails>,
      {organization: init.organization, router: init.router}
    );
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    OrganizationStore.onUpdate(defaultInit.organization);
    act(() => ProjectsStore.loadInitialData(defaultInit.projects));

    MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/`,
      body: {...group},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/events/recommended/`,
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
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/first-last-release/`,
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
      body: EnvironmentsFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${defaultInit.organization.slug}/${project.slug}/`,
      body: project,
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

    act(() => ProjectsStore.loadInitialData(defaultInit.projects));

    expect(await screen.findByText(group.shortId)).toBeInTheDocument();

    // Sample event alert should not show up
    expect(screen.queryByText(SAMPLE_EVENT_ALERT_TEXT)).not.toBeInTheDocument();
  });

  it('renders error when issue is not found', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/`,
      statusCode: 404,
    });
    MockApiClient.addMockResponse({
      url: `/organization/${defaultInit.organization.slug}/issues/${group.id}/events/recommended/`,
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
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/`,
      statusCode: 403,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/events/recommended/`,
      statusCode: 403,
    });

    createWrapper();
    expect(
      await screen.findByText(
        'No teams have access to this project yet. Ask an admin to add your team to this project.'
      )
    ).toBeInTheDocument();
  });

  it('fetches issue details for a given environment', async function () {
    const mock = MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/`,
      body: group,
    });

    const init = initializeOrg({
      router: {
        ...initRouter,
        location: LocationFixture({
          ...initRouter.location,
          query: {environment: 'staging'},
        }),
      },
    });
    createWrapper(init);

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            collapse: ['release', 'tags'],
            environment: ['staging'],
            expand: ['inbox', 'owners'],
          },
        })
      )
    );
  });

  it('renders substatus badge', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/`,
      body: {
        ...group,
        inbox: null,
        status: 'unresolved',
        substatus: 'ongoing',
      },
    });
    createWrapper({
      ...defaultInit,
      organization: {...defaultInit.organization},
    });
    expect(await screen.findByText('Ongoing')).toBeInTheDocument();
  });

  it('renders alert for sample event', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/tags/`,
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
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/`,
      body: {...group, project: {slug: 'other-project-slug'}},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${defaultInit.organization.slug}/other-project-slug/`,
      body: {},
    });

    createWrapper();

    expect(
      await screen.findByText('The project other-project-slug does not exist')
    ).toBeInTheDocument();
  });

  it('uses /recommended endpoint when feature flag is on and no event is provided', async function () {
    const recommendedMock = MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/events/recommended/`,
      statusCode: 200,
      body: event,
    });

    createWrapper();

    await waitFor(() => expect(recommendedMock).toHaveBeenCalledTimes(1));
  });

  it('uses /latest endpoint when default is set to latest', async function () {
    ConfigStore.loadInitialData(ConfigFixture({user: latestUser}));
    const latestMock = MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/events/latest/`,
      statusCode: 200,
      body: event,
    });

    createWrapper();

    await waitFor(() => expect(latestMock).toHaveBeenCalledTimes(1));
  });

  it('uses /oldest endpoint when default is set to oldest', async function () {
    ConfigStore.loadInitialData(ConfigFixture({user: oldestUser}));
    const oldestMock = MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/events/oldest/`,
      statusCode: 200,
      body: event,
    });

    createWrapper();

    await waitFor(() => expect(oldestMock).toHaveBeenCalledTimes(1));
  });

  it('uses /recommended endpoint when default is set to recommended', async function () {
    ConfigStore.loadInitialData(ConfigFixture({user: recommendedUser}));
    const recommendedMock = MockApiClient.addMockResponse({
      url: `/organizations/${defaultInit.organization.slug}/issues/${group.id}/events/recommended/`,
      statusCode: 200,
      body: event,
    });

    createWrapper();

    await waitFor(() => expect(recommendedMock).toHaveBeenCalledTimes(1));
  });
});
