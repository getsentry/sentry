import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {cleanup, mountWithTheme, waitFor} from 'sentry-test/reactTestingLibrary';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import GroupStore from 'app/stores/groupStore';
import ProjectsStore from 'app/stores/projectsStore';
import GroupDetails from 'app/views/organizationGroupDetails';

jest.unmock('app/utils/recreateRoute');

describe('groupDetails', () => {
  const group = TestStubs.Group();
  const event = TestStubs.Event();

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
      props: {currentTab: 'details', isEventRoute: false},
    },
  ];

  const {organization, project, router, routerContext} = initializeOrg({
    project: TestStubs.Project(),
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

  const createWrapper = (props = {organization, router, routerContext}) => {
    return mountWithTheme(
      <GroupDetails
        organization={props.organization}
        params={props.router.params}
        location={props.router.location}
        routes={props.router.routes}
      >
        <MockComponent />
      </GroupDetails>,
      {context: routerContext}
    );
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData(organization.projects);
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
  });
  afterEach(() => {
    cleanup();
    ProjectsStore.reset();
    GroupStore.reset();
    GlobalSelectionStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('renders', () => {
    ProjectsStore.reset();
    const {findByText, queryByText} = createWrapper();

    expect(queryByText(group.title)).toBeNull();

    ProjectsStore.loadInitialData(organization.projects);

    expect(findByText(group.title)).toBeTruthy();
  });

  it('renders error when issue is not found', () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      statusCode: 404,
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/events/latest/`,
      statusCode: 404,
    });

    const {findByText, queryByTestId} = createWrapper();

    expect(queryByTestId('loading-indicator')).toBeNull();
    expect(findByText('The issue you were looking for was not found.')).toBeTruthy();
  });

  it('renders MissingProjectMembership when trying to access issue in project the user does not belong to', () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      statusCode: 403,
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/events/latest/`,
      statusCode: 403,
    });
    const {queryByTestId, findByText} = createWrapper();

    expect(queryByTestId('loading-indicator')).toBeNull();
    expect(
      findByText("You'll need to join a team with access before you can view this data.")
    ).toBeTruthy();
  });

  it('fetches issue details for a given environment', () => {
    const props = initializeOrg({
      project: TestStubs.Project(),
      router: {
        location: {
          pathname: '/issues/groupId/',
          query: {environment: 'staging'},
        },
        params: {
          groupId: group.id,
        },
        routes,
      },
    });

    const {queryByTestId, findByText} = createWrapper(props);

    ProjectsStore.loadInitialData(props.organization.projects);

    expect(queryByTestId('loading-indicator')).toBeNull();

    expect(findByText('environment: staging')).toBeTruthy();
  });

  /**
   * This is legacy code that I'm not even sure still happens
   */
  it('redirects to new issue if params id !== id returned from API request', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: {...group, id: 'new-id'},
    });
    const {queryByText} = createWrapper();
    expect(queryByText('Group Details Mock')).toBeNull();
    await waitFor(() => {
      expect(browserHistory.push).toHaveBeenCalledTimes(1);
      expect(browserHistory.push).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/new-id/?foo=bar#hash'
      );
    });
  });

  it('renders issue event error', () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/events/latest/`,
      statusCode: 404,
    });
    const {findByText} = createWrapper();
    expect(findByText('eventError')).toBeTruthy();
  });

  it('renders for review reason', () => {
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
    ProjectsStore.reset();
    const {findByText} = createWrapper();

    ProjectsStore.loadInitialData(organization.projects);

    expect(findByText('New Issue')).toBeTruthy();
  });
});
