import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReleaseFixture} from 'sentry-fixture/release';
import {RouterFixture} from 'sentry-fixture/routerFixture';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as dashboardActions from 'sentry/actionCreators/dashboards';
import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import * as modals from 'sentry/actionCreators/modal';
import ConfigStore from 'sentry/stores/configStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import CreateDashboard from 'sentry/views/dashboards/create';
import DashboardDetail from 'sentry/views/dashboards/detail';
import EditAccessSelector from 'sentry/views/dashboards/editAccessSelector';
import * as types from 'sentry/views/dashboards/types';
import {DashboardState} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';
import ViewEditDashboard from 'sentry/views/dashboards/view';
import useWidgetBuilderState from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState');
jest.mock('sentry/actionCreators/indicator');

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  callback: IntersectionObserverCallback;
  elements = new Set<Element>();

  observe(target: Element): void {
    this.elements.add(target);
    // Always intersect the element right away
    this.triggerIntersection(true);
  }

  unobserve(): void {}
  disconnect(): void {}
  takeRecords() {}

  triggerIntersection(isIntersecting = true): void {
    const entries = Array.from(this.elements).map(target => ({
      time: Date.now(),
      target,
      boundingClientRect: target.getBoundingClientRect(),
      rootBounds: null,
      intersectionRect: isIntersecting
        ? target.getBoundingClientRect()
        : new DOMRectReadOnly(),
      intersectionRatio: isIntersecting ? 1 : 0,
      isIntersecting,
    }));

    if (entries.length > 0) {
      this.callback(entries as IntersectionObserverEntry[], this as any);
    }
  }
}

describe('Dashboards > Detail', () => {
  const organization = OrganizationFixture({
    features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
  });
  const projects = [ProjectFixture()];
  window.IntersectionObserver = MockIntersectionObserver as any;

  describe('prebuilt dashboards', () => {
    let initialData!: ReturnType<typeof initializeOrg>;

    beforeEach(() => {
      act(() => ProjectsStore.loadInitialData(projects));
      initialData = initializeOrg({organization});

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [ProjectFixture()],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [
          DashboardFixture([], {id: 'default-overview', title: 'Default'}),
          DashboardFixture([], {id: '1', title: 'Custom Errors'}),
        ],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/default-overview/',
        body: DashboardFixture([], {id: 'default-overview', title: 'Default'}),
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/visit/',
        method: 'POST',
        body: [],
        statusCode: 200,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/sdk-updates/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prompts-activity/',
        body: {},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: []},
      });
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/issues/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/stats/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/measurements-meta/',
        body: [],
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
    });

    // TODO(nar): Flaky test
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('assigns unique IDs to all widgets so grid keys are unique', async () => {
      const router = RouterFixture({
        location: initialData.router.location,
        params: {orgId: 'org-slug', dashboardId: 'default-overview'},
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: []},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/default-overview/',
        body: DashboardFixture(
          [
            WidgetFixture({
              queries: [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                  orderby: '-count()',
                },
              ],
              title: 'Default Widget 1',
              interval: '1d',
            }),
            WidgetFixture({
              queries: [
                {
                  name: '',
                  conditions: 'event.type:transaction',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                  orderby: '-count()',
                },
              ],
              title: 'Default Widget 2',
              interval: '1d',
            }),
          ],
          {id: 'default-overview', title: 'Default'}
        ),
      });
      initialData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'discover-query'],
        }),
      });

      render(
        <OrganizationContext value={initialData.organization}>
          <ViewEditDashboard />
        </OrganizationContext>,
        {
          router,
          deprecatedRouterMocks: true,
        }
      );

      expect(await screen.findByText('Default Widget 1')).toBeInTheDocument();
      expect(screen.getByText('Default Widget 2')).toBeInTheDocument();
    });

    it('opens the widget viewer modal in a prebuilt dashboard using the widget id specified in the url', async () => {
      const openWidgetViewerModal = jest.spyOn(modals, 'openWidgetViewerModal');

      render(<CreateDashboard />, {
        router: RouterFixture({
          location: {...initialData.router.location, pathname: '/widget/2/'},
          params: {templateId: 'default-template', widgetId: '2'},
        }),
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await waitFor(() => {
        expect(openWidgetViewerModal).toHaveBeenCalledWith(
          expect.objectContaining({
            organization: initialData.organization,
            widget: expect.objectContaining({
              displayType: 'line',
              interval: '5m',
              queries: [
                {
                  aggregates: ['count()'],
                  columns: [],
                  conditions: '',
                  fields: ['count()'],
                  name: 'Events',
                  orderby: 'count()',
                },
              ],
              title: 'Events',
              widgetType: types.WidgetType.ERRORS,
            }),
            onClose: expect.anything(),
          })
        );
      });
    });
  });

  describe('custom dashboards', () => {
    let initialData!: ReturnType<typeof initializeOrg>;
    let widgets!: Array<ReturnType<typeof WidgetFixture>>;
    let mockVisit!: jest.Mock;
    let mockPut!: jest.Mock;
    let mockScrollIntoView!: jest.Mock;

    beforeEach(() => {
      window.confirm = jest.fn();
      initialData = initializeOrg({
        organization,
        router: {
          location: LocationFixture(),
        },
      });
      PageFiltersStore.init();
      PageFiltersStore.onInitializeUrlState({
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      });
      widgets = [
        WidgetFixture({
          queries: [
            {
              name: '',
              conditions: 'event.type:error',
              fields: ['count()'],
              columns: [],
              aggregates: ['count()'],
              orderby: '-count()',
            },
          ],
          title: 'Errors',
          interval: '1d',
          widgetType: types.WidgetType.DISCOVER,
          id: '1',
        }),
        WidgetFixture({
          queries: [
            {
              name: '',
              conditions: 'event.type:transaction',
              fields: ['count()'],
              columns: [],
              aggregates: ['count()'],
              orderby: '-count()',
            },
          ],
          title: 'Transactions',
          interval: '1d',
          widgetType: types.WidgetType.DISCOVER,
          id: '2',
        }),
        WidgetFixture({
          queries: [
            {
              name: '',
              conditions: 'event.type:transaction transaction:/api/cats',
              fields: ['p50()'],
              columns: [],
              aggregates: ['p50()'],
              orderby: '-p50()',
            },
          ],
          title: 'p50 of /api/cats',
          interval: '1d',
          id: '3',
        }),
      ];
      mockVisit = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/visit/',
        method: 'POST',
        body: [],
        statusCode: 200,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [ProjectFixture()],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [
          {
            ...DashboardFixture([], {
              id: 'default-overview',
              title: 'Default',
            }),
            widgetDisplay: ['area'],
          },
          {
            ...DashboardFixture([], {
              id: '1',
              title: 'Custom Errors',
            }),
            widgetDisplay: ['area'],
          },
        ],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(widgets, {
          id: '1',
          title: 'Custom Errors',
          filters: {},
          createdBy: UserFixture({id: '1'}),
        }),
      });
      mockPut = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture(widgets, {id: '1', title: 'Custom Errors'}),
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: []},
      });
      MockApiClient.addMockResponse({
        method: 'POST',
        url: '/organizations/org-slug/dashboards/widgets/',
        body: [],
      });
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/recent-searches/',
        body: [],
      });
      MockApiClient.addMockResponse({
        method: 'GET',
        url: '/organizations/org-slug/issues/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/stats/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/sdk-updates/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prompts-activity/',
        body: {},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/measurements-meta/',
        body: [],
      });

      mockScrollIntoView = jest.fn();
      window.HTMLElement.prototype.scrollIntoView = mockScrollIntoView;
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
    });

    it('can remove widgets', async () => {
      const router = RouterFixture({
        location: initialData.router.location,
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture([widgets[0]!], {id: '1', title: 'Custom Errors'}),
      });
      render(
        <OrganizationContext value={initialData.organization}>
          <ViewEditDashboard />
        </OrganizationContext>,
        {
          router,
          deprecatedRouterMocks: true,
        }
      );

      await waitFor(() => expect(mockVisit).toHaveBeenCalledTimes(1));

      // Enter edit mode.
      await userEvent.click(screen.getByRole('button', {name: 'edit-dashboard'}));

      // Remove the second and third widgets
      await userEvent.click(
        (await screen.findAllByRole('button', {name: 'Delete Widget'}))[1]!
      );
      await userEvent.click(
        (await screen.findAllByRole('button', {name: 'Delete Widget'}))[1]!
      );

      // Save changes
      await userEvent.click(screen.getByRole('button', {name: 'Save and Finish'}));

      expect(updateMock).toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Custom Errors',
            widgets: [expect.objectContaining(widgets[0])],
          }),
        })
      );

      // Visit should not be called again on dashboard update
      expect(mockVisit).toHaveBeenCalledTimes(1);
    });

    it('appends dashboard-level filters to series request', async () => {
      const router = RouterFixture({
        location: initialData.router.location,
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(widgets, {
          id: '1',
          title: 'Custom Errors',
          filters: {release: ['abc@1.2.0']},
        }),
      });
      const mock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: [],
      });

      render(
        <OrganizationContext value={initialData.organization}>
          <ViewEditDashboard />
        </OrganizationContext>,
        {
          router,
          deprecatedRouterMocks: true,
        }
      );

      await waitFor(() =>
        expect(mock).toHaveBeenLastCalledWith(
          '/organizations/org-slug/events-stats/',
          expect.objectContaining({
            query: expect.objectContaining({
              query:
                '(event.type:transaction transaction:/api/cats) release:"abc@1.2.0" ',
            }),
          })
        )
      );
    });

    it('shows add widget option', async () => {
      const router = RouterFixture({
        location: initialData.router.location,
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      render(
        <OrganizationContext value={initialData.organization}>
          <ViewEditDashboard />
        </OrganizationContext>,
        {
          router,
          deprecatedRouterMocks: true,
        }
      );

      // Enter edit mode.
      await userEvent.click(await screen.findByRole('button', {name: 'edit-dashboard'}));
      expect(await screen.findByRole('button', {name: 'Add Widget'})).toBeInTheDocument();
    });

    it('shows top level release filter', async () => {
      const router = RouterFixture({
        location: initialData.router.location,
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      const mockReleases = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [ReleaseFixture()],
      });

      initialData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
        }),
      });

      render(
        <OrganizationContext value={initialData.organization}>
          <ViewEditDashboard />
        </OrganizationContext>,
        {
          router,
          organization: initialData.organization,
          deprecatedRouterMocks: true,
        }
      );
      expect(await screen.findByText('All Releases')).toBeInTheDocument();
      expect(mockReleases).toHaveBeenCalledTimes(1);
    });

    it('hides add widget option', async () => {
      const router = RouterFixture({
        location: initialData.router.location,
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      // @ts-expect-error this is assigning to readonly property...
      types.MAX_WIDGETS = 1;

      render(
        <OrganizationContext value={initialData.organization}>
          <ViewEditDashboard />
        </OrganizationContext>,
        {
          router,
          deprecatedRouterMocks: true,
        }
      );

      // Enter edit mode.
      await userEvent.click(await screen.findByRole('button', {name: 'edit-dashboard'}));
      expect(screen.queryByRole('button', {name: 'Add widget'})).not.toBeInTheDocument();
    });

    it('renders successfully if more widgets than stored layouts', async () => {
      const router = RouterFixture({
        location: initialData.router.location,
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      // A case where someone has async added widgets to a dashboard
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(
          [
            WidgetFixture({
              queries: [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                  orderby: '-count()',
                },
              ],
              title: 'First Widget',
              interval: '1d',
              id: '1',
              layout: {x: 0, y: 0, w: 2, h: 6, minH: 0},
            }),
            WidgetFixture({
              queries: [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                  orderby: '-count()',
                },
              ],
              title: 'Second Widget',
              interval: '1d',
              id: '2',
            }),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });

      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      expect(await screen.findByText('First Widget')).toBeInTheDocument();
      expect(await screen.findByText('Second Widget')).toBeInTheDocument();
    });

    it('does not trigger request if layout not updated', async () => {
      const router = RouterFixture({
        location: initialData.router.location,
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(
          [
            WidgetFixture({
              queries: [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                  orderby: '-count()',
                },
              ],
              title: 'First Widget',
              interval: '1d',
              id: '1',
              layout: {x: 0, y: 0, w: 2, h: 6, minH: 0},
            }),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });

      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByRole('button', {name: 'edit-dashboard'}));
      await userEvent.click(await screen.findByText('Save and Finish'));

      expect(screen.getByRole('button', {name: 'edit-dashboard'})).toBeInTheDocument();
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('renders the custom resize handler for a widget', async () => {
      const router = RouterFixture({
        location: initialData.router.location,
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(
          [
            WidgetFixture({
              queries: [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                  orderby: '-count()',
                },
              ],
              title: 'First Widget',
              interval: '1d',
              id: '1',
              layout: {x: 0, y: 0, w: 2, h: 6, minH: 0},
            }),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });

      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByRole('button', {name: 'edit-dashboard'}));
      const widget = (await screen.findByText('First Widget')).closest(
        '.react-grid-item'
      ) as HTMLElement;
      const resizeHandle = within(widget).getByTestId('custom-resize-handle');

      expect(resizeHandle).toBeVisible();
    });

    it('does not trigger an alert when the widgets have no layout and user cancels without changes', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(
          [
            WidgetFixture({
              queries: [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                  orderby: '-count()',
                },
              ],
              title: 'First Widget',
              interval: '1d',
              id: '1',
              layout: null,
            }),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });

      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByRole('button', {name: 'edit-dashboard'}));
      await userEvent.click(await screen.findByText('Cancel'));

      expect(window.confirm).not.toHaveBeenCalled();
    });

    it('opens the widget viewer modal using the widget index specified in the url', async () => {
      const router = RouterFixture({
        location: {...initialData.router.location, pathname: '/widget/0/'},
        params: {orgId: 'org-slug', dashboardId: '1', widgetId: '0'},
      });
      const openWidgetViewerModal = jest.spyOn(modals, 'openWidgetViewerModal');
      const widget = WidgetFixture({
        queries: [
          {
            name: '',
            conditions: 'event.type:error',
            fields: ['count()'],
            aggregates: ['count()'],
            columns: [],
            orderby: '',
          },
        ],
        title: 'First Widget',
        interval: '1d',
        id: '1',
        layout: null,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture([widget], {id: '1', title: 'Custom Errors'}),
      });

      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await waitFor(() => {
        expect(openWidgetViewerModal).toHaveBeenCalledWith(
          expect.objectContaining({
            organization: initialData.organization,
            widget,
            onClose: expect.anything(),
          })
        );
      });
    });

    it('redirects user to dashboard url if widget is not found', async () => {
      const router = RouterFixture({
        location: {
          ...initialData.router.location,
          pathname: '/widget/123/',
        },
        params: {orgId: 'org-slug', dashboardId: '1', widgetId: '123'},
      });
      const openWidgetViewerModal = jest.spyOn(modals, 'openWidgetViewerModal');
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture([], {id: '1', title: 'Custom Errors'}),
      });
      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      expect(await screen.findByText('All Releases')).toBeInTheDocument();

      expect(openWidgetViewerModal).not.toHaveBeenCalled();
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/dashboard/1/',
          query: {},
        })
      );
    });

    it('saves a new dashboard with the page filters', async () => {
      const mockPOST = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        method: 'POST',
        body: [],
      });
      const locationWithFilters = {
        ...initialData.router.location,
        query: {
          ...initialData.router.location.query,
          statsPeriod: '7d',
          project: [2],
          environment: ['alpha', 'beta'],
        },
      };
      render(<CreateDashboard />, {
        router: RouterFixture({
          location: locationWithFilters,
          params: {},
        }),
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByText('Save and Finish'));
      expect(mockPOST).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/',
        expect.objectContaining({
          data: expect.objectContaining({
            projects: [2],
            environment: ['alpha', 'beta'],
            period: '7d',
          }),
        })
      );
    });

    it('saves a template with the page filters', async () => {
      const mockPOST = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        method: 'POST',
        body: [],
      });
      const locationWithFilters = {
        ...initialData.router.location,
        query: {
          ...initialData.router.location.query,
          statsPeriod: '7d',
          project: [2],
          environment: ['alpha', 'beta'],
        },
      };
      render(<CreateDashboard />, {
        router: RouterFixture({
          location: locationWithFilters,
          params: {templateId: 'default-template'},
        }),
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByText('Add Dashboard'));
      expect(mockPOST).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/',
        expect.objectContaining({
          data: expect.objectContaining({
            projects: [2],
            environment: ['alpha', 'beta'],
            period: '7d',
          }),
        })
      );
    });

    it('does not render save and cancel buttons on templates', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          ReleaseFixture({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      render(<CreateDashboard />, {
        router: RouterFixture({
          location: initialData.router.location,
          params: {templateId: 'default-template'},
        }),
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByText('24H'));
      await userEvent.click(screen.getByText('Last 7 days'));
      await screen.findByText('7D');

      expect(screen.queryByTestId('filter-bar-cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });

    it('opens the widget viewer with saved dashboard filters', async () => {
      const router = RouterFixture({
        location: {...initialData.router.location, pathname: '/widget/1/'},
        params: {orgId: 'org-slug', dashboardId: '1', widgetId: '1'},
      });

      const openWidgetViewerModal = jest.spyOn(modals, 'openWidgetViewerModal');
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(widgets, {
          id: '1',
          filters: {release: ['sentry-android-shop@1.2.0']},
        }),
      });
      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await waitFor(() => {
        expect(openWidgetViewerModal).toHaveBeenCalledWith(
          expect.objectContaining({
            dashboardFilters: {release: ['sentry-android-shop@1.2.0']},
          })
        );
      });
    });

    it('opens the widget viewer with unsaved dashboard filters', async () => {
      const router = RouterFixture({
        location: {
          ...initialData.router.location,
          pathname: '/widget/1/',
          query: {release: ['unsaved-release-filter@1.2.0']},
        },
        params: {orgId: 'org-slug', dashboardId: '1', widgetId: '1'},
      });

      const openWidgetViewerModal = jest.spyOn(modals, 'openWidgetViewerModal');
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(widgets, {
          id: '1',
          filters: {release: ['sentry-android-shop@1.2.0']},
        }),
      });
      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });

      await waitFor(() => {
        expect(openWidgetViewerModal).toHaveBeenCalledWith(
          expect.objectContaining({
            dashboardFilters: {release: ['unsaved-release-filter@1.2.0']},
          })
        );
      });
    });

    it('can save dashboard filters in existing dashboard', async () => {
      const router = RouterFixture({
        location: {
          ...LocationFixture(),
          query: {
            statsPeriod: '7d',
            release: ['sentry-android-shop@1.2.0'],
          },
        },
        params: {orgId: 'org-slug', dashboardId: '1'},
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          ReleaseFixture({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
        }),
        router: {
          location: {
            ...LocationFixture(),
            query: {
              statsPeriod: '7d',
              release: ['sentry-android-shop@1.2.0'],
            },
          },
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByText('Save'));

      expect(mockPut).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            period: '7d',
            filters: {release: ['sentry-android-shop@1.2.0']},
          }),
        })
      );
    });

    it('can clear dashboard filters in compact select', async () => {
      const router = RouterFixture({
        location: {
          ...LocationFixture(),
          query: {
            statsPeriod: '7d',
          },
        },
        params: {orgId: 'org-slug', dashboardId: '1'},
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(widgets, {
          id: '1',
          title: 'Custom Errors',
          filters: {release: ['sentry-android-shop@1.2.0']},
        }),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          ReleaseFixture({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
        }),
        router: {
          location: {
            ...LocationFixture(),
            query: {
              statsPeriod: '7d',
            },
          },
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      await screen.findByText('7D');
      await userEvent.click(await screen.findByText('sentry-android-shop@1.2.0'));
      await userEvent.click(screen.getAllByText('Clear')[0]!);
      screen.getByText('All Releases');
      await userEvent.click(document.body);

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith(
          expect.objectContaining({
            query: expect.objectContaining({
              release: [''],
              globalFilter: [''],
            }),
          })
        );
      });
    });

    it('can save absolute time range in existing dashboard', async () => {
      const router = RouterFixture({
        location: {
          ...LocationFixture(),
          query: {
            start: '2022-07-14T07:00:00',
            end: '2022-07-19T23:59:59',
            utc: 'true',
          },
        },
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
        }),
        router: {
          location: {
            ...LocationFixture(),
            query: {
              start: '2022-07-14T07:00:00',
              end: '2022-07-19T23:59:59',
              utc: 'true',
            },
          },
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByText('Save'));

      expect(mockPut).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            start: '2022-07-14T07:00:00.000',
            end: '2022-07-19T23:59:59.000',
            utc: true,
          }),
        })
      );
    });

    it('can clear dashboard filters in existing dashboard', async () => {
      const router = RouterFixture({
        location: {
          ...LocationFixture(),
          query: {
            statsPeriod: '7d',
            environment: ['alpha', 'beta'],
          },
        },
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          ReleaseFixture({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
        }),
        router: {
          location: {
            ...LocationFixture(),
            query: {
              statsPeriod: '7d',
              environment: ['alpha', 'beta'],
            },
          },
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      await screen.findByText('7D');
      await userEvent.click(await screen.findByText('All Releases'));
      await userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));
      await userEvent.keyboard('{Escape}');

      await userEvent.click(screen.getByTestId('filter-bar-cancel'));

      screen.getByText('All Releases');
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            project: undefined,
            statsPeriod: undefined,
            environment: undefined,
          }),
        })
      );
    });

    it('disables the edit-dashboard button when there are unsaved filters', async () => {
      const router = RouterFixture({
        location: {
          ...LocationFixture(),
          query: {
            statsPeriod: '7d',
            environment: ['alpha', 'beta'],
          },
        },
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          ReleaseFixture({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: [
            'dashboards-basic',
            'dashboards-edit',
            'discover-basic',
            'discover-query',
          ],
        }),
        router: {
          location: {
            ...LocationFixture(),
            query: {
              statsPeriod: '7d',
              environment: ['alpha', 'beta'],
            },
          },
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      expect(await screen.findByText('Save')).toBeInTheDocument();
      expect(screen.getByTestId('filter-bar-cancel')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'edit-dashboard'})).toBeDisabled();
    });

    it('ignores the order of selection of page filters to render unsaved filters', async () => {
      const router = RouterFixture({
        location: {
          ...LocationFixture(),
          query: {
            environment: ['beta', 'alpha'],
          },
        },
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      const testProjects = [
        ProjectFixture({id: '1', name: 'first', environments: ['alpha', 'beta']}),
        ProjectFixture({id: '2', name: 'second', environments: ['alpha', 'beta']}),
      ];

      act(() => ProjectsStore.loadInitialData(testProjects));
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: testProjects,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(widgets, {
          id: '1',
          title: 'Custom Errors',
          filters: {},
          environment: ['alpha', 'beta'],
        }),
      });

      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
        }),
        router: {
          location: {
            ...LocationFixture(),
            query: {
              environment: ['beta', 'alpha'], // Reversed order from saved dashboard
            },
          },
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      await waitFor(() => expect(screen.queryAllByText('Loading\u2026')).toEqual([]));
      await userEvent.click(screen.getByRole('button', {name: 'All Envs'}));
      expect(screen.getByRole('row', {name: 'alpha'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.getByRole('row', {name: 'beta'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      // Save and Cancel should not appear because alpha, beta is the same as beta, alpha
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(screen.queryByTestId('filter-bar-cancel')).not.toBeInTheDocument();
    });

    it('uses releases from the URL query params', async () => {
      const router = RouterFixture({
        location: {
          ...LocationFixture(),
          query: {
            release: ['not-selected-1'],
          },
        },
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
        }),
        router: {
          location: {
            ...LocationFixture(),
            query: {
              release: ['not-selected-1'],
            },
          },
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      await screen.findByText(/not-selected-1/);
      screen.getByText('Save');
      screen.getByTestId('filter-bar-cancel');
    });

    it('resets release in URL params', async () => {
      const router = RouterFixture({
        location: {
          ...LocationFixture(),
          query: {
            release: ['not-selected-1'],
          },
        },
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture(widgets, {
          id: '1',
          title: 'Custom Errors',
          filters: {
            release: ['abc'],
          },
        }),
      });
      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
        }),
        router: {
          location: {
            ...LocationFixture(),
            query: {
              release: ['not-selected-1'],
            },
          },
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      await screen.findByText(/not-selected-1/);
      await userEvent.click(screen.getByTestId('filter-bar-cancel'));

      // release isn't used in the redirect
      expect(router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: {
            end: undefined,
            environment: undefined,
            project: undefined,
            start: undefined,
            statsPeriod: undefined,
            utc: undefined,
          },
        })
      );
    });

    it('reflects selections in the release filter in the query params', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          ReleaseFixture({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
        }),
        router: {
          location: LocationFixture(),
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByText('All Releases'));
      await userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));
      await userEvent.click(document.body);

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith(
          expect.objectContaining({
            query: expect.objectContaining({
              release: ['sentry-android-shop@1.2.0'],
            }),
          })
        );
      });
    });

    it('persists release selections made during search requests that do not appear in default query', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      // Default response
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          ReleaseFixture({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      // Mocked search results
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          ReleaseFixture({
            id: '9',
            shortVersion: 'search-result',
            version: 'search-result',
          }),
        ],
        match: [MockApiClient.matchData({query: 's'})],
      });
      const testData = initializeOrg({
        organization: OrganizationFixture({
          features: [
            'dashboards-basic',
            'dashboards-edit',
            'discover-basic',
            'discover-query',
          ],
        }),
        router: {
          location: LocationFixture(),
        },
      });
      render(<ViewEditDashboard />, {
        router,
        organization: testData.organization,
        deprecatedRouterMocks: true,
      });

      await userEvent.click(await screen.findByText('All Releases'));
      await userEvent.type(screen.getByPlaceholderText('Search\u2026'), 's');
      await userEvent.click(await screen.findByRole('option', {name: 'search-result'}));

      // Validate that after search is cleared, search result still appears
      expect(await screen.findByText('Latest Release(s)')).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'search-result'})).toBeInTheDocument();
    });

    it('renders edit access selector', async () => {
      render(
        <EditAccessSelector
          dashboard={DashboardFixture([], {id: '1', title: 'Custom Errors'})}
          onChangeEditAccess={jest.fn()}
        />,
        {
          router: initialData.router,
          organization: initialData.organization,
          deprecatedRouterMocks: true,
        }
      );

      await userEvent.click(await screen.findByText('Editors:'));
      expect(screen.getByText('Creator')).toBeInTheDocument();
      expect(screen.getByText('Select All')).toBeInTheDocument();
    });

    it('creates and updates new permissions for dashboard with no edit perms initialized', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      const mockPUT = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture([], {id: '1', title: 'Custom Errors'}),
      });

      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });
      await userEvent.click(await screen.findByText('Editors:'));

      // deselects 'Select All' so only creator has edit access
      expect(await screen.findByText('Select All')).toBeEnabled();
      expect(await screen.findByRole('option', {name: 'Select All'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await userEvent.click(screen.getByRole('option', {name: 'Select All'}));
      expect(await screen.findByRole('option', {name: 'Select All'})).toHaveAttribute(
        'aria-selected',
        'false'
      );

      await userEvent.click(await screen.findByText('Save Changes'));

      await waitFor(() => {
        expect(mockPUT).toHaveBeenCalledTimes(1);
      });
      expect(mockPUT).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            permissions: {isEditableByEveryone: false, teamsWithEditAccess: []},
          }),
        })
      );
    });

    it('creator can update permissions for dashboard', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      const mockPUT = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture([], {id: '1', title: 'Custom Errors'}),
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture([], {
          id: '1',
          title: 'Custom Errors',
          createdBy: UserFixture({id: '781629'}),
          permissions: {isEditableByEveryone: false},
        }),
      });

      const currentUser = UserFixture({id: '781629'});
      ConfigStore.set('user', currentUser);

      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });
      await userEvent.click(await screen.findByText('Editors:'));

      // selects 'Select All' so everyone has edit access
      expect(await screen.findByRole('option', {name: 'Select All'})).toBeEnabled();
      expect(await screen.findByRole('option', {name: 'Select All'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await userEvent.click(screen.getByRole('option', {name: 'Select All'}));
      expect(await screen.findByRole('option', {name: 'Select All'})).toHaveAttribute(
        'aria-selected',
        'true'
      );

      await userEvent.click(await screen.findByText('Save Changes'));

      await waitFor(() => {
        expect(mockPUT).toHaveBeenCalledTimes(1);
      });
      expect(mockPUT).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            permissions: {isEditableByEveryone: true, teamsWithEditAccess: []},
          }),
        })
      );
    });

    it('creator can update permissions with teams for dashboard', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      const mockPUT = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture([], {id: '1', title: 'Custom Errors'}),
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture([], {
          id: '1',
          title: 'Custom Errors',
          createdBy: UserFixture({id: '781629'}),
          permissions: {isEditableByEveryone: false},
        }),
      });

      const currentUser = UserFixture({id: '781629'});
      ConfigStore.set('user', currentUser);

      const teamData = [
        {
          id: '1',
          slug: 'team1',
          name: 'Team 1',
        },
        {
          id: '2',
          slug: 'team2',
          name: 'Team 2',
        },
        {
          id: '3',
          slug: 'team3',
          name: 'Team 3',
        },
      ];
      const teams = teamData.map(data => TeamFixture(data));

      TeamStore.loadInitialData(teams);

      render(<ViewEditDashboard />, {
        router,
        organization: initialData.organization,
        deprecatedRouterMocks: true,
      });
      await userEvent.click(await screen.findByText('Editors:'));

      expect(await screen.findByRole('option', {name: 'Select All'})).toBeEnabled();
      expect(await screen.findByRole('option', {name: 'Select All'})).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await userEvent.click(screen.getByRole('option', {name: '#team1'}));
      await userEvent.click(screen.getByRole('option', {name: '#team2'}));
      await userEvent.click(await screen.findByText('Save Changes'));

      await waitFor(() => {
        expect(mockPUT).toHaveBeenCalledTimes(1);
      });
      expect(mockPUT).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            permissions: {isEditableByEveryone: false, teamsWithEditAccess: [1, 2]},
          }),
        })
      );
    });

    it('disables edit dashboard and add widget button if user cannot edit dashboard', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [
          DashboardFixture([], {
            id: '1',
            title: 'Custom Errors',
            createdBy: UserFixture({id: '238900'}),
            permissions: {isEditableByEveryone: false},
          }),
        ],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture([], {
          id: '1',
          title: 'Custom Errors',
          createdBy: UserFixture({id: '238900'}),
          permissions: {isEditableByEveryone: false},
        }),
      });

      const currentUser = UserFixture({id: '781629', isSuperuser: false});
      ConfigStore.set('user', currentUser);

      render(<ViewEditDashboard />, {
        router,

        organization: {
          features: initialData.organization.features,
          access: ['org:read'],
        },

        deprecatedRouterMocks: true,
      });

      await screen.findByText('Editors:');
      expect(screen.getByRole('button', {name: 'edit-dashboard'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Add Widget'})).toBeDisabled();
    });

    it('disables widget edit, duplicate, and delete button when user does not have edit perms', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      const widget = {
        displayType: types.DisplayType.TABLE,
        interval: '1d',
        queries: [
          {
            name: 'Test Widget',
            fields: ['count()', 'count_unique(user)', 'epm()', 'project'],
            columns: ['project'],
            aggregates: ['count()', 'count_unique(user)', 'epm()'],
            conditions: '',
            orderby: '',
          },
        ],
        title: 'Transactions',
        id: '1',
        widgetType: types.WidgetType.DISCOVER,
      };
      const mockDashboard = DashboardFixture([widget], {
        id: '1',
        title: 'Custom Errors',
        createdBy: UserFixture({id: '238900'}),
        permissions: {isEditableByEveryone: false},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: mockDashboard,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: mockDashboard,
      });

      const currentUser = UserFixture({id: '781629'});
      ConfigStore.set('user', currentUser);

      render(<ViewEditDashboard />, {
        router,

        organization: {
          features: initialData.organization.features,
          access: ['org:read'],
        },

        deprecatedRouterMocks: true,
      });

      await screen.findByText('Editors:');
      expect(screen.getByRole('button', {name: 'edit-dashboard'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Add Widget'})).toBeDisabled();
      await userEvent.click(await screen.findByLabelText('Widget actions'));
      expect(
        screen.getByRole('menuitemradio', {name: 'Duplicate Widget'})
      ).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('menuitemradio', {name: 'Delete Widget'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByRole('menuitemradio', {name: 'Edit Widget'})).toHaveAttribute(
        'aria-disabled',
        'true'
      );
    });

    it('renders favorite button in unstarred state', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture([], {id: '1', title: 'Custom Errors', isFavorited: false}),
      });
      render(<ViewEditDashboard />, {
        router,

        organization: {
          features: initialData.organization.features,
        },

        deprecatedRouterMocks: true,
      });

      const favoriteButton = await screen.findByLabelText('star-dashboard');
      expect(favoriteButton).toBeInTheDocument();
      expect(await screen.findByLabelText('Star')).toBeInTheDocument();
    });

    it('renders favorite button in favorited state', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture([], {id: '1', title: 'Custom Errors', isFavorited: true}),
      });
      render(<ViewEditDashboard />, {
        router,

        organization: {
          features: initialData.organization.features,
        },

        deprecatedRouterMocks: true,
      });

      const favoriteButton = await screen.findByLabelText('star-dashboard');
      expect(favoriteButton).toBeInTheDocument();
      expect(await screen.findByLabelText('Unstar')).toBeInTheDocument();
    });

    it('toggles favorite button', async () => {
      const router = RouterFixture({
        location: LocationFixture(),
        params: {orgId: 'org-slug', dashboardId: '1'},
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: DashboardFixture([], {id: '1', title: 'Custom Errors', isFavorited: true}),
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/favorite/',
        method: 'PUT',
        body: {isFavorited: false},
      });
      render(<ViewEditDashboard />, {
        router,

        organization: {
          features: initialData.organization.features,
        },

        deprecatedRouterMocks: true,
      });

      const favoriteButton = await screen.findByLabelText('star-dashboard');
      expect(favoriteButton).toBeInTheDocument();

      expect(await screen.findByLabelText('Unstar')).toBeInTheDocument();
      await userEvent.click(favoriteButton);
      expect(await screen.findByLabelText('Star')).toBeInTheDocument();
    });

    it('does not render save or edit features on prebuilt insights dashboards', async () => {
      render(
        <DashboardDetail
          initialState={DashboardState.VIEW}
          dashboard={DashboardFixture([], {
            prebuiltId: PrebuiltDashboardId.FRONTEND_SESSION_HEALTH,
          })}
          dashboards={[]}
          onDashboardUpdate={jest.fn()}
        />
      );

      await userEvent.click(await screen.findByText('24H'));
      await userEvent.click(screen.getByText('Last 7 days'));
      await screen.findByText('7D');

      expect(screen.queryByTestId('filter-bar-cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(screen.queryByText('Editors:')).not.toBeInTheDocument();
      expect(screen.queryByText('Add Widget')).not.toBeInTheDocument();
    });

    describe('widget builder redesign', () => {
      let mockUpdateDashboard!: jest.SpyInstance;
      beforeEach(() => {
        initialData = initializeOrg({
          organization: OrganizationFixture({
            features: ['dashboards-basic', 'dashboards-edit', 'discover-query'],
          }),
        });

        // Mock just the updateDashboard function
        mockUpdateDashboard = jest
          .spyOn(dashboardActions, 'updateDashboard')
          .mockResolvedValue({
            ...DashboardFixture([WidgetFixture({id: '1', title: 'Custom Widget'})]),
          });

        jest.mocked(useWidgetBuilderState).mockReturnValue({
          dispatch: jest.fn(),
          state: {},
        });
      });

      afterEach(() => {
        mockUpdateDashboard.mockRestore();
      });

      it('opens the widget builder slideout when clicking add widget', async () => {
        render(
          <DashboardDetail
            initialState={DashboardState.VIEW}
            dashboard={DashboardFixture([])}
            dashboards={[]}
            onDashboardUpdate={jest.fn()}
          />,
          {
            organization: initialData.organization,
          }
        );
        await userEvent.click(await screen.findByRole('button', {name: 'Add Widget'}));
        await userEvent.click(
          await screen.findByRole('menuitemradio', {name: 'Create Custom Widget'})
        );
        expect(await screen.findByText('Custom Widget Builder')).toBeInTheDocument();
      });

      it('opens the widget builder library slideout when clicking add widget from widget library', async () => {
        render(
          <DashboardDetail
            initialState={DashboardState.VIEW}
            dashboard={DashboardFixture([])}
            dashboards={[]}
            onDashboardUpdate={jest.fn()}
          />,
          {
            organization: initialData.organization,
          }
        );
        await userEvent.click(await screen.findByRole('button', {name: 'Add Widget'}));
        await userEvent.click(
          await screen.findByRole('menuitemradio', {name: 'From Widget Library'})
        );
        expect(await screen.findByText('Widget Library')).toBeInTheDocument();
      });

      it('opens the widget builder slideout when clicking add widget in edit mode', async () => {
        render(
          <DashboardDetail
            initialState={DashboardState.EDIT}
            dashboard={DashboardFixture([])}
            dashboards={[]}
            onDashboardUpdate={jest.fn()}
          />,
          {
            organization: initialData.organization,
          }
        );
        await userEvent.click(await screen.findByLabelText('Add Widget'));
        await userEvent.click(
          await screen.findByRole('menuitemradio', {name: 'Create Custom Widget'})
        );
        expect(await screen.findByText('Custom Widget Builder')).toBeInTheDocument();
      });

      it('opens the widget builder library slideout when clicking add widget from widget library in edit mode', async () => {
        render(
          <DashboardDetail
            initialState={DashboardState.EDIT}
            dashboard={DashboardFixture([])}
            dashboards={[]}
            onDashboardUpdate={jest.fn()}
          />,
          {
            organization: initialData.organization,
          }
        );
        await userEvent.click(await screen.findByLabelText('Add Widget'));
        await userEvent.click(
          await screen.findByRole('menuitemradio', {name: 'From Widget Library'})
        );
        expect(await screen.findByText('Widget Library')).toBeInTheDocument();
      });

      it('allows for editing a widget in edit mode', async () => {
        const mockWidget = WidgetFixture({id: '1', title: 'Custom Widget'});
        const mockDashboard = DashboardFixture([mockWidget], {
          id: '1',
          title: 'Custom Errors',
        });
        jest.mocked(useWidgetBuilderState).mockReturnValue({
          dispatch: jest.fn(),
          state: {
            title: 'Updated Widget',
          },
        });
        render(
          <DashboardDetail
            initialState={DashboardState.EDIT}
            dashboard={mockDashboard}
            dashboards={[]}
            onDashboardUpdate={jest.fn()}
          />,
          {
            organization: initialData.organization,

            // Mock the widgetIndex param so it's available when the widget builder opens
            router: {...initialData.router, params: {widgetIndex: '0'}},

            deprecatedRouterMocks: true,
          }
        );

        expect(await screen.findByText('Custom Widget')).toBeInTheDocument();
        await userEvent.click(await screen.findByRole('button', {name: 'Edit Widget'}));

        expect(await screen.findByText('Edit Widget')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Update Widget'));

        // The widget builder is closed after the widget is updated
        await waitFor(() => {
          expect(screen.queryByText('Edit Widget')).not.toBeInTheDocument();
        });

        // The widget is updated in the dashboard
        expect(screen.getByText('Updated Widget')).toBeInTheDocument();
      });

      it('allows for creating a widget in edit mode', async () => {
        const mockDashboard = DashboardFixture([], {
          id: '1',
          title: 'Custom Errors',
        });
        jest.mocked(useWidgetBuilderState).mockReturnValue({
          dispatch: jest.fn(),
          state: {
            title: 'Totally new widget',
          },
        });
        render(
          <DashboardDetail
            initialState={DashboardState.EDIT}
            dashboard={mockDashboard}
            dashboards={[]}
            onDashboardUpdate={jest.fn()}
          />,
          {
            organization: initialData.organization,
            router: initialData.router,
            deprecatedRouterMocks: true,
          }
        );

        await userEvent.click(await screen.findByLabelText('Add Widget'));
        await userEvent.click(
          await screen.findByRole('menuitemradio', {name: 'Create Custom Widget'})
        );

        expect(await screen.findByText('Custom Widget Builder')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Add Widget'));

        // The widget builder is closed after the widget is updated
        await waitFor(() => {
          expect(screen.queryByText('Custom Widget Builder')).not.toBeInTheDocument();
        });

        // The widget is added in the dashboard
        expect(await screen.findByText('Totally new widget')).toBeInTheDocument();
        expect(mockScrollIntoView).toHaveBeenCalled();
      });

      it('allows for editing a widget in view mode', async () => {
        const mockWidget = WidgetFixture({id: '1', title: 'Custom Widget'});
        const mockDashboard = DashboardFixture([mockWidget], {
          id: '1',
          title: 'Custom Errors',
        });
        jest.mocked(useWidgetBuilderState).mockReturnValue({
          dispatch: jest.fn(),
          state: {
            title: 'Updated Widget Title',
          },
        });
        render(
          <DashboardDetail
            initialState={DashboardState.VIEW}
            dashboard={mockDashboard}
            dashboards={[]}
            onDashboardUpdate={jest.fn()}
          />,
          {
            organization: initialData.organization,

            // Mock the widgetIndex param so it's available when the widget builder opens
            router: {...initialData.router, params: {widgetIndex: '0'}},

            deprecatedRouterMocks: true,
          }
        );

        expect(await screen.findByText('Custom Widget')).toBeInTheDocument();
        await userEvent.click(await screen.findByLabelText('Widget actions'));
        await userEvent.click(
          await screen.findByRole('menuitemradio', {name: 'Edit Widget'})
        );

        expect(await screen.findByText('Edit Widget')).toBeInTheDocument();

        await userEvent.click(screen.getByText('Update Widget'));

        // The widget builder is closed after the widget is updated
        await waitFor(() => {
          expect(screen.queryByText('Edit Widget')).not.toBeInTheDocument();
        });

        // The update action is called with the updated widget
        expect(mockUpdateDashboard).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            widgets: [expect.objectContaining({title: 'Updated Widget Title'})],
          })
        );
        expect(mockScrollIntoView).toHaveBeenCalled();
      });

      it('allows for creating a widget in view mode', async () => {
        const mockDashboard = DashboardFixture([], {
          id: '1',
          title: 'Custom Errors',
        });
        jest.mocked(useWidgetBuilderState).mockReturnValue({
          dispatch: jest.fn(),
          state: {
            title: 'Totally new widget',
          },
        });
        render(
          <DashboardDetail
            initialState={DashboardState.VIEW}
            dashboard={mockDashboard}
            dashboards={[]}
            onDashboardUpdate={jest.fn()}
          />,
          {
            organization: initialData.organization,
            router: initialData.router,
            deprecatedRouterMocks: true,
          }
        );

        await userEvent.click(await screen.findByRole('button', {name: 'Add Widget'}));
        await userEvent.click(
          await screen.findByRole('menuitemradio', {name: 'Create Custom Widget'})
        );

        expect(await screen.findByText('Custom Widget Builder')).toBeInTheDocument();

        await userEvent.click(
          await within(screen.getByTestId('widget-slideout')).findByText('Add Widget')
        );

        // The widget builder is closed after the widget is updated
        await waitFor(() => {
          expect(screen.queryByText('Custom Widget Builder')).not.toBeInTheDocument();
        });

        // The update action is called with the new widget
        expect(mockUpdateDashboard).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            widgets: [expect.objectContaining({title: 'Totally new widget'})],
          })
        );
        await waitFor(() => {
          expect(addLoadingMessage).toHaveBeenCalledWith('Saving widget');
        });
      });
    });
  });
});
