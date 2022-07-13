import {createMemoryHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {ReleaseContext} from 'sentry/views/releases/detail';
import {ReleaseActivityList} from 'sentry/views/releases/detail/activity/releaseActivity';
import {ReleaseActivityType} from 'sentry/views/releases/detail/activity/types';
import {RouteContext} from 'sentry/views/routeContext';

const activities = [
  {
    type: ReleaseActivityType.CREATED,
    dateAdded: new Date().toISOString(),
    data: {},
  },
  {
    type: ReleaseActivityType.DEPLOYED,
    dateAdded: new Date().toISOString(),
    data: {environment: 'production'},
  },
  {
    type: ReleaseActivityType.ISSUE,
    dateAdded: new Date().toISOString(),
    data: {group: TestStubs.Group()},
  },
];

describe('ReleaseActivity', () => {
  const {organization, project, router} = initializeOrg({
    organization: {
      features: ['active-release-monitor-alpha'],
    },
  });
  const release = TestStubs.Release({version: '1.0.0'});

  beforeEach(() => {
    GroupStore.init();
    act(() => ProjectsStore.loadInitialData(organization.projects));
    const memoryHistory = createMemoryHistory();
    memoryHistory.push('/');
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    GroupStore.teardown();
    ProjectsStore.teardown();
  });

  it('renders active release activity', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/${project.slug}/releases/${release.version}/activity/`,
      body: activities,
    });

    render(
      <ReleaseContext.Provider value={{release, project}}>
        <RouteContext.Provider
          value={{
            location: router.location,
            params: {orgId: organization.slug, release: release.version},
            router,
            routes: [],
          }}
        >
          <ReleaseActivityList />
        </RouteContext.Provider>
      </ReleaseContext.Provider>,
      {organization}
    );

    // await tick();
    expect(
      await screen.findByText('Deployed to production', undefined, {timeout: 3000})
    ).toBeInTheDocument();
    screen.debug();
  });
});
