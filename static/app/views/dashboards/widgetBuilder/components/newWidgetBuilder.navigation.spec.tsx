import {DashboardFixture, DashboardListItemFixture} from 'sentry-fixture/dashboard';
import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {act, render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {triggerResizeObservers} from 'sentry-test/resizeObserver';

import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {WidgetBuilderV2} from 'sentry/views/dashboards/widgetBuilder/components/newWidgetBuilder';
import {Navigation} from 'sentry/views/navigation';
import {PrimaryNavigationContextProvider} from 'sentry/views/navigation/primaryNavigationContext';

// Rendering the real Navigation component pulls in navigation-inference
// logic that is slow and can exceed the default 5 second test timeout.
jest.setTimeout(30_000);

const mockUsingCustomerDomain = jest.fn();

jest.mock('sentry/constants', () => {
  const sentryConstant = jest.requireActual('sentry/constants');
  return {
    ...sentryConstant,
    get USING_CUSTOMER_DOMAIN() {
      return mockUsingCustomerDomain();
    },
  };
});

const organization = OrganizationFixture({
  features: [
    'open-membership',
    'visibility-explore-view',
    'discover',
    'discover-basic',
    'discover-query',
    'dashboards-basic',
    'dashboards-edit',
  ],
});

const projects = [
  ProjectFixture({id: '1', slug: 'project-1', isMember: true, hasAccess: false}),
];

describe('NewWidgetBuilder navigation layout integration', () => {
  const onCloseMock = jest.fn();
  const onSaveMock = jest.fn();

  beforeEach(() => {
    localStorage.clear();
    MockApiClient.clearMockResponses();

    OrganizationStore.init();
    ProjectsStore.loadInitialData(projects);

    ConfigStore.set('user', UserFixture());
    ConfigStore.set('customerDomain', null);

    OrganizationStore.onUpdate(organization, {replace: true});

    mockUsingCustomerDomain.mockReturnValue(false);

    // Mocks required to render the real Navigation component
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/broadcasts/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: projects,
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-1/',
      body: projects[0],
    });
    MockApiClient.addMockResponse({
      url: '/assistant/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/group-search-views/starred/',
      body: [GroupSearchViewFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/explore/saved/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [DashboardListItemFixture({id: '1', title: 'Dashboard'})],
    });

    // Mocks required to render WidgetBuilderV2
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboard/1/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [], start: 0, end: 0},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/measurements-meta/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
  });

  it('positions itself against the width of the real rendered navigation bar', async () => {
    render(
      <PrimaryNavigationContextProvider>
        <Navigation />
        <WidgetBuilderV2
          isOpen
          onClose={onCloseMock}
          dashboard={DashboardFixture([])}
          dashboardFilters={{}}
          onSave={onSaveMock}
          openWidgetTemplates={false}
          setOpenWidgetTemplates={jest.fn()}
        />
      </PrimaryNavigationContextProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
            query: {project: '-1'},
          },
        },
      }
    );

    // Sanity check that the real Navigation component renders the element
    // WidgetBuilderV2 looks up via `[data-navigation-component="navigation-layout"]`.
    await screen.findByRole('navigation', {name: 'Primary Navigation'});
    const navigationLayoutElement = document.querySelector(
      '[data-navigation-component="navigation-layout"]'
    );
    expect(navigationLayoutElement).toBeInTheDocument();

    // mock width on the real navigation element
    // and notify the widget builder's ResizeObserver so it picks up the change.
    Object.defineProperty(navigationLayoutElement!, 'clientWidth', {
      configurable: true,
      get: () => 220,
    });
    act(triggerResizeObservers);

    const widgetBuilderContainer = await screen.findByTestId('widget-builder-container');
    await waitFor(() => {
      expect(widgetBuilderContainer).toHaveStyle('left: 220px');
    });
  });
});
