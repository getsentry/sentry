import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueCategory} from 'sentry/types';
import GroupDetails from 'sentry/views/organizationGroupDetails';

jest.unmock('sentry/utils/recreateRoute');

const SAMPLE_EVENT_ALERT_TEXT =
  'You are viewing a sample error. Configure Sentry to start viewing real errors.';

describe('groupDetails', () => {
  const group = TestStubs.Group({issueCategory: IssueCategory.ERROR});
  const event = TestStubs.Event();
  const project = TestStubs.Project({teams: [TestStubs.Team()]});
  const selection = {environments: []};

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

  const {organization, router, routerContext} = initializeOrg({
    project,
    router: {
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
    },
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

  const createWrapper = (props = {selection}) => {
    return render(
      <GroupDetails {...router} router={router} selection={props.selection}>
        <MockComponent />
      </GroupDetails>,
      {context: routerContext}
    );
  };

  beforeEach(() => {
    act(() => ProjectsStore.loadInitialData(organization.projects));

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
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/first-last-release/`,
      body: {firstRelease: group.firstRelease, lastRelease: group.lastRelease},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
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
      url: `/organizations/${organization.slug}/environments/`,
      body: TestStubs.Environments(),
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

    act(() => ProjectsStore.loadInitialData(organization.projects));

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
    createWrapper({
      selection: {environments: ['staging']},
    });

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
    act(() => ProjectsStore.reset());
    createWrapper();

    act(() => ProjectsStore.loadInitialData(organization.projects));

    expect(await screen.findByText('New Issue')).toBeInTheDocument();
  });

  it('renders alert for sample event', async function () {
    const sampleGroup = TestStubs.Group({issueCategory: IssueCategory.ERROR});
    sampleGroup.tags.push({key: 'sample_event'});
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: {...sampleGroup},
    });

    createWrapper();

    expect(await screen.findByText(SAMPLE_EVENT_ALERT_TEXT)).toBeInTheDocument();
  });
});
