import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {ReleaseContext} from 'sentry/views/releases/detail';
import ReleaseDetailsActivity from 'sentry/views/releases/detail/activity';
import {ReleaseActivityType} from 'sentry/views/releases/detail/activity/types';
import {RouteContext} from 'sentry/views/routeContext';

describe('ReleaseActivity', () => {
  const {organization, project, router, routerContext} = initializeOrg({
    organization: {
      features: ['active-release-monitor-alpha'],
    },
  });
  const release = TestStubs.Release({version: '1.0.0'});
  const group = TestStubs.Group();
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
      data: {group},
    },
  ];

  beforeEach(() => {
    GroupStore.init();
    act(() => ProjectsStore.loadInitialData(organization.projects));
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    GroupStore.teardown();
    ProjectsStore.teardown();
  });

  it('renders active release activity', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/releases/${release.version}/activity/`,
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
          <ReleaseDetailsActivity />
        </RouteContext.Provider>
      </ReleaseContext.Provider>,
      {organization, context: routerContext}
    );

    expect(await screen.findByText('Release Created')).toBeInTheDocument();
    expect(screen.getByText('Deployed to production')).toBeInTheDocument();
    expect(screen.getByText(group.culprit)).toBeInTheDocument();
    expect(
      screen.getByText(
        'Waiting for new issues in this release to notify release participants ...'
      )
    ).toBeInTheDocument();
  });
});
