import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import GroupDetails from 'app/views/organizationGroupDetails';
import ProjectsStore from 'app/stores/projectsStore';
import GroupStore from 'app/stores/groupStore';

jest.unmock('app/utils/recreateRoute');

describe('groupDetails', function () {
  let wrapper;
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
  let MockComponent;

  const createWrapper = (props = {organization, router, routerContext}) => {
    wrapper = mountWithTheme(
      <GroupDetails
        organization={props.organization}
        params={props.router.params}
        location={props.router.location}
        routes={props.router.routes}
      >
        <MockComponent />
      </GroupDetails>,
      props.routerContext
    );
    return wrapper;
  };

  let issueDetailsMock;
  beforeEach(function () {
    ProjectsStore.loadInitialData(organization.projects);
    MockComponent = jest.fn(() => null);
    issueDetailsMock = MockApiClient.addMockResponse({
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
  });
  afterEach(async function () {
    if (wrapper) {
      wrapper.unmount();
    }
    ProjectsStore.reset();
    GroupStore.reset();
    GlobalSelectionStore.reset();
    MockApiClient.clearMockResponses();
    await tick();
    await tick();
    await tick();
  });

  it('renders', async function () {
    ProjectsStore.reset();
    await tick();

    wrapper = createWrapper();

    await tick();
    wrapper.update();

    expect(MockComponent).not.toHaveBeenCalled();

    ProjectsStore.loadInitialData(organization.projects);
    await tick();
    await tick();

    expect(MockComponent).toHaveBeenLastCalledWith(
      {
        environments: [],
        group,
        project: expect.objectContaining({
          id: project.id,
          slug: project.slug,
        }),
        event,
      },
      {}
    );

    expect(issueDetailsMock).toHaveBeenCalledTimes(1);
  });

  it('renders error when issue is not found', async function () {
    issueDetailsMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      statusCode: 404,
    });

    wrapper = createWrapper();

    await tick();
    wrapper.update();

    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
    expect(issueDetailsMock).toHaveBeenCalledTimes(1);
    expect(MockComponent).not.toHaveBeenCalled();
    expect(wrapper.find('Alert').text()).toEqual(
      'The issue you were looking for was not found.'
    );
  });

  it('renders error message when failing to retrieve issue details and can retry request', async function () {
    issueDetailsMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      statusCode: 403,
    });
    wrapper = createWrapper();

    await tick();
    wrapper.update();

    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
    expect(issueDetailsMock).toHaveBeenCalledTimes(1);
    expect(MockComponent).not.toHaveBeenCalled();
    expect(wrapper.find('LoadingError').text()).toEqual(
      'There was an error loading data.Retry'
    );

    wrapper.find('button[aria-label="Retry"]').simulate('click');

    expect(issueDetailsMock).toHaveBeenCalledTimes(2);
  });

  it('fetches issue details for a given environment', async function () {
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

    wrapper = createWrapper(props);

    ProjectsStore.loadInitialData(props.organization.projects);

    await tick();
    // Reflux and stuff
    await tick();
    wrapper.update();

    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);

    expect(issueDetailsMock).toHaveBeenCalledTimes(1);
    expect(issueDetailsMock).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: {
          environment: ['staging'],
        },
      })
    );
    expect(MockComponent).toHaveBeenLastCalledWith(
      {
        environments: ['staging'],
        group,
        project: expect.objectContaining({
          id: project.id,
          slug: project.slug,
        }),
        event,
      },
      {}
    );
  });

  /**
   * This is legacy code that I'm not even sure still happens
   */
  it('redirects to new issue if params id !== id returned from API request', async function () {
    issueDetailsMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/`,
      body: {...group, id: 'new-id'},
    });
    wrapper = createWrapper();

    await tick();
    expect(MockComponent).not.toHaveBeenCalled();
    expect(browserHistory.push).toHaveBeenCalledTimes(1);
    expect(browserHistory.push).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/new-id/?foo=bar#hash'
    );
  });
});
