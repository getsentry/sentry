import {browserHistory} from 'react-router';

import {enforceActOnUseLegacyStoreHook, mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import * as modals from 'sentry/actionCreators/modal';
import ProjectsStore from 'sentry/stores/projectsStore';
import CreateDashboard from 'sentry/views/dashboardsV2/create';
import {constructGridItemKey} from 'sentry/views/dashboardsV2/layoutUtils';
import {DashboardWidgetSource} from 'sentry/views/dashboardsV2/types';
import * as types from 'sentry/views/dashboardsV2/types';
import ViewEditDashboard from 'sentry/views/dashboardsV2/view';
import {OrganizationContext} from 'sentry/views/organizationContext';

describe('Dashboards > Detail', function () {
  enforceActOnUseLegacyStoreHook();

  const organization = TestStubs.Organization({
    features: [
      'global-views',
      'dashboards-basic',
      'dashboards-edit',
      'discover-query',
      'dashboard-grid-layout',
    ],
  });
  const projects = [TestStubs.Project()];

  describe('prebuilt dashboards', function () {
    let wrapper, initialData;

    beforeEach(function () {
      act(() => ProjectsStore.loadInitialData(projects));
      initialData = initializeOrg({organization});

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/projects/',
        body: [TestStubs.Project()],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [
          TestStubs.Dashboard([], {id: 'default-overview', title: 'Default'}),
          TestStubs.Dashboard([], {id: '1', title: 'Custom Errors'}),
        ],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/default-overview/',
        body: TestStubs.Dashboard([], {id: 'default-overview', title: 'Default'}),
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
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
      if (wrapper) {
        wrapper.unmount();
      }
    });

    it('assigns unique IDs to all widgets so grid keys are unique', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {data: []},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/default-overview/',
        body: TestStubs.Dashboard(
          [
            TestStubs.Widget(
              [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                },
              ],
              {
                title: 'Default Widget 1',
                interval: '1d',
              }
            ),
            TestStubs.Widget(
              [
                {
                  name: '',
                  conditions: 'event.type:transaction',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                },
              ],
              {
                title: 'Default Widget 2',
                interval: '1d',
              }
            ),
          ],
          {id: 'default-overview', title: 'Default'}
        ),
      });
      initialData = initializeOrg({
        organization: TestStubs.Organization({
          features: [
            'global-views',
            'dashboards-basic',
            'discover-query',
            'dashboard-grid-layout',
          ],
          projects: [TestStubs.Project()],
        }),
      });

      wrapper = mountWithTheme(
        <OrganizationContext.Provider value={initialData.organization}>
          <ViewEditDashboard
            organization={initialData.organization}
            params={{orgId: 'org-slug', dashboardId: 'default-overview'}}
            router={initialData.router}
            location={initialData.router.location}
          />
        </OrganizationContext.Provider>,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      const dashboardInstance = wrapper.find('Dashboard').instance();
      const assignedIds = new Set(
        dashboardInstance.props.dashboard.widgets.map(constructGridItemKey)
      );
      expect(assignedIds.size).toBe(dashboardInstance.props.dashboard.widgets.length);
    });
  });

  describe('custom dashboards', function () {
    let wrapper, initialData, widgets, mockVisit, mockPut;

    const openEditModal = jest.spyOn(modals, 'openAddDashboardWidgetModal');
    beforeEach(function () {
      window.confirm = jest.fn();
      initialData = initializeOrg({
        organization,
        router: {
          location: TestStubs.location(),
        },
      });
      widgets = [
        TestStubs.Widget(
          [
            {
              name: '',
              conditions: 'event.type:error',
              fields: ['count()'],
              columns: [],
              aggregates: ['count()'],
            },
          ],
          {
            title: 'Errors',
            interval: '1d',
            widgetType: 'discover',
            id: '1',
          }
        ),
        TestStubs.Widget(
          [
            {
              name: '',
              conditions: 'event.type:transaction',
              fields: ['count()'],
              columns: [],
              aggregates: ['count()'],
            },
          ],
          {
            title: 'Transactions',
            interval: '1d',
            widgetType: 'discover',
            id: '2',
          }
        ),
        TestStubs.Widget(
          [
            {
              name: '',
              conditions: 'event.type:transaction transaction:/api/cats',
              fields: ['p50()'],
              columns: [],
              aggregates: ['p50()'],
            },
          ],
          {
            title: 'p50 of /api/cats',
            interval: '1d',
            id: '3',
          }
        ),
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
        body: [TestStubs.Project()],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [
          TestStubs.Dashboard([], {
            id: 'default-overview',
            title: 'Default',
            widgetDisplay: ['area'],
          }),
          TestStubs.Dashboard([], {
            id: '1',
            title: 'Custom Errors',
            widgetDisplay: ['area'],
          }),
        ],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard(widgets, {
          id: '1',
          title: 'Custom Errors',
          filters: {},
        }),
      });
      mockPut = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: TestStubs.Dashboard(widgets, {id: '1', title: 'Custom Errors'}),
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
        url: '/organizations/org-slug/eventsv2/',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/users/',
        method: 'GET',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-geo/',
        body: {data: [], meta: {}},
      });
    });

    afterEach(function () {
      MockApiClient.clearMockResponses();
      jest.clearAllMocks();
      if (wrapper) {
        wrapper.unmount();
        wrapper = null;
      }
    });

    it('can remove widgets', async function () {
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: TestStubs.Dashboard([widgets[0]], {id: '1', title: 'Custom Errors'}),
      });
      wrapper = mountWithTheme(
        <OrganizationContext.Provider value={initialData.organization}>
          <ViewEditDashboard
            organization={initialData.organization}
            params={{orgId: 'org-slug', dashboardId: '1'}}
            router={initialData.router}
            location={initialData.router.location}
          />
        </OrganizationContext.Provider>,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      expect(mockVisit).toHaveBeenCalledTimes(1);

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');

      // Remove the second and third widgets
      wrapper
        .find('WidgetCard')
        .at(1)
        .find('Button[data-test-id="widget-delete"]')
        .simulate('click');

      wrapper
        .find('WidgetCard')
        .at(1)
        .find('Button[data-test-id="widget-delete"]')
        .simulate('click');

      // Save changes
      wrapper.find('Controls Button[data-test-id="dashboard-commit"]').simulate('click');
      await tick();

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

    it('appends dashboard-level filters to series request', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard(widgets, {
          id: '1',
          title: 'Custom Errors',
          filters: {release: ['abc@1.2.0']},
        }),
      });
      const mock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: [],
      });

      wrapper = mountWithTheme(
        <OrganizationContext.Provider value={initialData.organization}>
          <ViewEditDashboard
            organization={initialData.organization}
            params={{orgId: 'org-slug', dashboardId: '1'}}
            router={initialData.router}
            location={initialData.router.location}
          />
        </OrganizationContext.Provider>,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      expect(mock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'event.type:transaction transaction:/api/cats release:abc@1.2.0 ',
          }),
        })
      );
    });

    it('can enter edit mode for widgets', async function () {
      wrapper = mountWithTheme(
        <OrganizationContext.Provider value={initialData.organization}>
          <ViewEditDashboard
            organization={initialData.organization}
            params={{orgId: 'org-slug', dashboardId: '1'}}
            router={initialData.router}
            location={initialData.router.location}
          />
        </OrganizationContext.Provider>,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');
      wrapper.update();

      const card = wrapper.find('WidgetCard').first();
      card.find('WidgetCardPanel').simulate('mouseOver');

      // Edit the first widget
      wrapper
        .find('WidgetCard')
        .first()
        .find('Button[data-test-id="widget-edit"]')
        .simulate('click');

      expect(openEditModal).toHaveBeenCalledTimes(1);
      expect(openEditModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget: {
            id: '1',
            interval: '1d',
            layout: {h: 2, minH: 2, w: 2, x: 0, y: 0},
            queries: [
              {
                conditions: 'event.type:error',
                fields: ['count()'],
                aggregates: ['count()'],
                columns: [],
                name: '',
              },
            ],
            title: 'Errors',
            type: 'line',
            widgetType: 'discover',
          },
        })
      );
    });

    it('shows add widget option', async function () {
      wrapper = mountWithTheme(
        <OrganizationContext.Provider value={initialData.organization}>
          <ViewEditDashboard
            organization={initialData.organization}
            params={{orgId: 'org-slug', dashboardId: '1'}}
            router={initialData.router}
            location={initialData.router.location}
          />
        </OrganizationContext.Provider>,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');
      wrapper.update();
      expect(wrapper.find('AddWidget').exists()).toBe(true);
    });

    it('opens custom modal when add widget option is clicked', async function () {
      wrapper = mountWithTheme(
        <OrganizationContext.Provider value={initialData.organization}>
          <ViewEditDashboard
            organization={initialData.organization}
            params={{orgId: 'org-slug', dashboardId: '1'}}
            router={initialData.router}
            location={initialData.router.location}
          />
        </OrganizationContext.Provider>,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');
      wrapper.update();
      wrapper.find('AddButton[data-test-id="widget-add"]').simulate('click');
      expect(openEditModal).toHaveBeenCalledTimes(1);
    });

    it('shows top level release filter', async function () {
      const mockReleases = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [TestStubs.Release()],
      });

      initialData = initializeOrg({
        organization: TestStubs.Organization({
          features: [
            'global-views',
            'dashboards-basic',
            'dashboards-edit',
            'discover-query',
            'dashboards-top-level-filter',
          ],
          projects: [TestStubs.Project()],
        }),
      });

      wrapper = mountWithTheme(
        <OrganizationContext.Provider value={initialData.organization}>
          <ViewEditDashboard
            organization={initialData.organization}
            params={{orgId: 'org-slug', dashboardId: '1'}}
            router={initialData.router}
            location={initialData.router.location}
          />
        </OrganizationContext.Provider>,
        initialData.routerContext
      );
      await act(async () => {
        await tick();
        wrapper.update();
      });
      expect(wrapper.find('ReleasesSelectControl').exists()).toBe(true);
      expect(mockReleases).toHaveBeenCalledTimes(1);
    });

    it('opens widget library when add widget option is clicked', async function () {
      initialData = initializeOrg({
        organization: TestStubs.Organization({
          features: [
            'global-views',
            'dashboards-basic',
            'dashboards-edit',
            'discover-query',
          ],
          projects: [TestStubs.Project()],
        }),
      });

      wrapper = mountWithTheme(
        <OrganizationContext.Provider value={initialData.organization}>
          <ViewEditDashboard
            organization={initialData.organization}
            params={{orgId: 'org-slug', dashboardId: '1'}}
            router={initialData.router}
            location={initialData.router.location}
          />
        </OrganizationContext.Provider>,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');
      wrapper.update();
      wrapper.find('AddButton[data-test-id="widget-add"]').simulate('click');
      expect(openEditModal).toHaveBeenCalledTimes(1);
      expect(openEditModal).toHaveBeenCalledWith(
        expect.objectContaining({
          source: types.DashboardWidgetSource.LIBRARY,
        })
      );
    });

    it('hides add widget option', async function () {
      types.MAX_WIDGETS = 1;

      wrapper = mountWithTheme(
        <OrganizationContext.Provider value={initialData.organization}>
          <ViewEditDashboard
            organization={initialData.organization}
            params={{orgId: 'org-slug', dashboardId: '1'}}
            router={initialData.router}
            location={initialData.router.location}
          />
        </OrganizationContext.Provider>,
        initialData.routerContext
      );
      await tick();
      wrapper.update();

      // Enter edit mode.
      wrapper.find('Controls Button[data-test-id="dashboard-edit"]').simulate('click');
      wrapper.update();
      expect(wrapper.find('AddWidget').exists()).toBe(false);
    });

    it('renders successfully if more widgets than stored layouts', async function () {
      // A case where someone has async added widgets to a dashboard
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard(
          [
            TestStubs.Widget(
              [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                },
              ],
              {
                title: 'First Widget',
                interval: '1d',
                id: '1',
                layout: {i: 'grid-item-1', x: 0, y: 0, w: 2, h: 6},
              }
            ),
            TestStubs.Widget(
              [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                },
              ],
              {
                title: 'Second Widget',
                interval: '1d',
                id: '2',
              }
            ),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });
      render(
        <ViewEditDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext, organization: initialData.organization}
      );
      await tick();

      await screen.findByText('First Widget');
      await screen.findByText('Second Widget');
    });

    it('does not trigger request if layout not updated', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard(
          [
            TestStubs.Widget(
              [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                },
              ],
              {
                title: 'First Widget',
                interval: '1d',
                id: '1',
                layout: {i: 'grid-item-1', x: 0, y: 0, w: 2, h: 6},
              }
            ),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });
      render(
        <ViewEditDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext, organization: initialData.organization}
      );
      await tick();

      userEvent.click(screen.getByText('Edit Dashboard'));
      userEvent.click(screen.getByText('Save and Finish'));
      await tick();

      expect(screen.getByText('Edit Dashboard')).toBeInTheDocument();
      expect(mockPut).not.toHaveBeenCalled();
    });

    it('renders the custom resize handler for a widget', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard(
          [
            TestStubs.Widget(
              [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                },
              ],
              {
                title: 'First Widget',
                interval: '1d',
                id: '1',
                layout: {i: 'grid-item-1', x: 0, y: 0, w: 2, h: 6},
              }
            ),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });
      render(
        <ViewEditDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext, organization: initialData.organization}
      );
      await tick();

      userEvent.click(await screen.findByText('Edit Dashboard'));
      const widget = screen.getByText('First Widget').closest('.react-grid-item');
      const resizeHandle = within(widget).getByTestId('custom-resize-handle');

      expect(resizeHandle).toBeVisible();
    });

    it('does not trigger an alert when the widgets have no layout and user cancels without changes', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard(
          [
            TestStubs.Widget(
              [
                {
                  name: '',
                  conditions: 'event.type:error',
                  fields: ['count()'],
                  aggregates: ['count()'],
                  columns: [],
                },
              ],
              {
                title: 'First Widget',
                interval: '1d',
                id: '1',
                layout: null,
              }
            ),
          ],
          {id: '1', title: 'Custom Errors'}
        ),
      });
      render(
        <ViewEditDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        {context: initialData.routerContext, organization: initialData.organization}
      );
      await tick();

      userEvent.click(await screen.findByText('Edit Dashboard'));
      userEvent.click(await screen.findByText('Cancel'));

      expect(window.confirm).not.toHaveBeenCalled();
    });

    it('opens the widget viewer modal using the widget id specified in the url', () => {
      const openWidgetViewerModal = jest.spyOn(modals, 'openWidgetViewerModal');
      const widget = TestStubs.Widget(
        [
          {
            name: '',
            conditions: 'event.type:error',
            fields: ['count()'],
            aggregates: ['count()'],
            columns: [],
            orderby: '',
          },
        ],
        {
          title: 'First Widget',
          interval: '1d',
          id: '1',
          layout: null,
        }
      );
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard([widget], {id: '1', title: 'Custom Errors'}),
      });

      render(
        <ViewEditDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1', widgetId: '1'}}
          router={initialData.router}
          location={{...initialData.router.location, pathname: '/widget/123/'}}
        />,
        {context: initialData.routerContext, organization: initialData.organization}
      );

      expect(openWidgetViewerModal).toHaveBeenCalledWith(
        expect.objectContaining({
          organization: initialData.organization,
          widget,
          onClose: expect.anything(),
        })
      );
    });

    it('redirects user to dashboard url if widget is not found', () => {
      const openWidgetViewerModal = jest.spyOn(modals, 'openWidgetViewerModal');
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard([], {id: '1', title: 'Custom Errors'}),
      });
      render(
        <ViewEditDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1', widgetId: '123'}}
          router={initialData.router}
          location={{...initialData.router.location, pathname: '/widget/123/'}}
        />,
        {context: initialData.routerContext, organization: initialData.organization}
      );

      expect(openWidgetViewerModal).not.toHaveBeenCalled();
      expect(initialData.router.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/organizations/org-slug/dashboard/1/',
          query: {},
        })
      );
    });

    it('opens the edit widget modal when clicking the edit button', async () => {
      const widget = TestStubs.Widget(
        [
          {
            name: '',
            conditions: 'event.type:error',
            fields: ['count()'],
            aggregates: ['count()'],
            columns: [],
            orderby: '',
          },
        ],
        {
          title: 'First Widget',
          interval: '1d',
          id: '1',
          layout: null,
        }
      );
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: TestStubs.Dashboard([widget], {id: '1', title: 'Custom Errors'}),
      });

      render(
        <ViewEditDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', dashboardId: '1', widgetId: '1'}}
          router={initialData.router}
          location={{...initialData.router.location, pathname: '/widget/123/'}}
        />,
        {context: initialData.routerContext, organization: initialData.organization}
      );

      renderGlobalModal({context: initialData.routerContext});

      userEvent.click(await screen.findByRole('button', {name: 'Edit Widget'}));
      expect(openEditModal).toHaveBeenCalledWith(
        expect.objectContaining({
          widget,
          organization: initialData.organization,
          source: DashboardWidgetSource.DASHBOARDS,
        })
      );
    });

    it('opens the widget viewer modal in a prebuilt dashboard using the widget id specified in the url', () => {
      const openWidgetViewerModal = jest.spyOn(modals, 'openWidgetViewerModal');

      render(
        <CreateDashboard
          organization={initialData.organization}
          params={{orgId: 'org-slug', templateId: 'default-template', widgetId: '2'}}
          router={initialData.router}
          location={{...initialData.router.location, pathname: '/widget/2/'}}
        />,
        {context: initialData.routerContext, organization: initialData.organization}
      );

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
                conditions: '!event.type:transaction',
                fields: ['count()'],
                name: 'Events',
                orderby: 'count()',
              },
            ],
            title: 'Events',
            widgetType: 'discover',
          }),
          onClose: expect.anything(),
        })
      );
    });

    it('saves a new dashboard with the page filters', async () => {
      const mockPOST = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        method: 'POST',
        body: [],
      });
      render(
        <CreateDashboard
          organization={{
            ...initialData.organization,
            features: [
              ...initialData.organization.features,
              'dashboards-top-level-filter',
            ],
          }}
          params={{orgId: 'org-slug'}}
          router={initialData.router}
          location={{
            ...initialData.router.location,
            query: {
              ...initialData.router.location.query,
              statsPeriod: '7d',
              project: [2],
              environment: ['alpha', 'beta'],
            },
          }}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );

      userEvent.click(await screen.findByText('Save and Finish'));
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
      render(
        <CreateDashboard
          organization={{
            ...initialData.organization,
            features: [
              ...initialData.organization.features,
              'dashboards-top-level-filter',
            ],
          }}
          params={{orgId: 'org-slug', templateId: 'default-template'}}
          router={initialData.router}
          location={{
            ...initialData.router.location,
            query: {
              ...initialData.router.location.query,
              statsPeriod: '7d',
              project: [2],
              environment: ['alpha', 'beta'],
            },
          }}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );

      userEvent.click(await screen.findByText('Add Dashboard'));
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
          TestStubs.Release({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      render(
        <CreateDashboard
          organization={{
            ...initialData.organization,
            features: [
              ...initialData.organization.features,
              'dashboards-top-level-filter',
            ],
          }}
          params={{orgId: 'org-slug', templateId: 'default-template'}}
          router={initialData.router}
          location={initialData.router.location}
        />,
        {
          context: initialData.routerContext,
          organization: initialData.organization,
        }
      );

      userEvent.click(await screen.findByText('24H'));
      userEvent.click(screen.getByText('Last 7 days'));

      expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });

    it('can save dashboard filters in existing dashboard', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          TestStubs.Release({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      const testData = initializeOrg({
        organization: TestStubs.Organization({
          features: [
            'global-views',
            'dashboards-basic',
            'dashboards-edit',
            'discover-query',
            'dashboard-grid-layout',
            'dashboards-top-level-filter',
          ],
        }),
        router: {
          location: {
            ...TestStubs.location(),
            query: {
              statsPeriod: '7d',
            },
          },
        },
      });
      render(
        <ViewEditDashboard
          organization={testData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={testData.router}
          location={testData.router.location}
        />,
        {context: testData.routerContext, organization: testData.organization}
      );

      await screen.findByText('7D');
      userEvent.click(await screen.findByText('All Releases'));
      userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));

      userEvent.click(screen.getByText('Save'));

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

    it('can save absolute time range in existing dashboard', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [],
      });
      const testData = initializeOrg({
        organization: TestStubs.Organization({
          features: [
            'global-views',
            'dashboards-basic',
            'dashboards-edit',
            'discover-query',
            'dashboard-grid-layout',
            'dashboards-top-level-filter',
          ],
        }),
        router: {
          location: {
            ...TestStubs.location(),
            query: {
              start: '2022-07-14T07:00:00',
              end: '2022-07-19T23:59:59',
              utc: 'true',
            },
          },
        },
      });
      render(
        <ViewEditDashboard
          organization={testData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={testData.router}
          location={testData.router.location}
        />,
        {context: testData.routerContext, organization: testData.organization}
      );

      userEvent.click(await screen.findByText('Save'));

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
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          TestStubs.Release({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      const testData = initializeOrg({
        organization: TestStubs.Organization({
          features: [
            'global-views',
            'dashboards-basic',
            'dashboards-edit',
            'discover-query',
            'dashboard-grid-layout',
            'dashboards-top-level-filter',
          ],
        }),
        router: {
          location: {
            ...TestStubs.location(),
            query: {
              statsPeriod: '7d',
              project: [1, 2],
              environment: ['alpha', 'beta'],
            },
          },
        },
      });
      render(
        <ViewEditDashboard
          organization={testData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={testData.router}
          location={testData.router.location}
        />,
        {context: testData.routerContext, organization: testData.organization}
      );

      await screen.findByText('7D');
      userEvent.click(await screen.findByText('All Releases'));
      userEvent.click(screen.getByText('sentry-android-shop@1.2.0'));
      userEvent.keyboard('{esc}');

      userEvent.click(screen.getByText('Cancel'));

      screen.getByText('All Releases');
      expect(browserHistory.replace).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            project: undefined,
            statsPeriod: undefined,
            environment: undefined,
          }),
        })
      );
    });

    it('disables dashboard actions when there are unsaved filters', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/releases/',
        body: [
          TestStubs.Release({
            shortVersion: 'sentry-android-shop@1.2.0',
            version: 'sentry-android-shop@1.2.0',
          }),
        ],
      });
      const testData = initializeOrg({
        organization: TestStubs.Organization({
          features: [
            'global-views',
            'dashboards-basic',
            'dashboards-edit',
            'discover-basic',
            'discover-query',
            'dashboard-grid-layout',
            'dashboards-top-level-filter',
          ],
        }),
        router: {
          location: {
            ...TestStubs.location(),
            query: {
              statsPeriod: '7d',
              project: [1, 2],
              environment: ['alpha', 'beta'],
            },
          },
        },
      });
      render(
        <ViewEditDashboard
          organization={testData.organization}
          params={{orgId: 'org-slug', dashboardId: '1'}}
          router={testData.router}
          location={testData.router.location}
        />,
        {context: testData.routerContext, organization: testData.organization}
      );

      expect(await screen.findByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Add Widget'})).toBeDisabled();
      expect(screen.getByRole('button', {name: 'Edit Dashboard'})).toBeDisabled();

      userEvent.click(screen.getAllByLabelText('Widget actions')[0]);

      expect(screen.getByTestId('edit-widget')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByTestId('duplicate-widget')).toHaveAttribute(
        'aria-disabled',
        'true'
      );
      expect(screen.getByTestId('delete-widget')).toHaveAttribute(
        'aria-disabled',
        'true'
      );

      // Open in discover shouldn't be disabled
      expect(screen.getByTestId('open-in-discover')).toHaveAttribute(
        'aria-disabled',
        'false'
      );
    });
  });
});
