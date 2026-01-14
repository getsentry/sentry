import {LocationFixture} from 'sentry-fixture/locationFixture';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import AddToDashboardModal from 'sentry/components/modals/widgetBuilder/addToDashboardModal';
import {DashboardCreateLimitWrapper} from 'sentry/views/dashboards/createLimitWrapper';
import type {
  DashboardDetails,
  DashboardListItem,
  Widget,
} from 'sentry/views/dashboards/types';
import {
  DashboardWidgetSource,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

jest.mock('sentry/components/lazyRender', () => ({
  LazyRender: ({children}: {children: React.ReactNode}) => children,
}));
jest.mock('sentry/views/dashboards/createLimitWrapper');

const mockDashboardCreateLimitWrapper = jest.mocked(DashboardCreateLimitWrapper);

describe('add to dashboard modal', () => {
  let eventsStatsMock!: jest.Mock;
  let initialData!: ReturnType<typeof initializeOrg>;
  let widget: Widget;

  const testDashboardListItem: DashboardListItem = {
    id: '1',
    title: 'Test Dashboard',
    createdBy: undefined,
    dateCreated: '2020-01-01T00:00:00.000Z',
    widgetDisplay: [DisplayType.AREA],
    widgetPreview: [],
    projects: [],
    environment: [],
    filters: {},
  };
  const testDashboard: DashboardDetails = {
    id: '1',
    title: 'Test Dashboard',
    createdBy: undefined,
    dateCreated: '2020-01-01T00:00:00.000Z',
    widgets: [],
    environment: [],
    projects: [1],
    period: '1h',
    filters: {release: ['abc@v1.2.0']},
  };
  const defaultSelection = {
    projects: [],
    environments: [],
    datetime: {
      start: null,
      end: null,
      period: '24h',
      utc: false,
    },
  };

  beforeEach(() => {
    initialData = initializeOrg();
    widget = {
      title: 'Test title',
      description: 'Test description',
      displayType: DisplayType.LINE,
      interval: '5m',
      queries: [
        {
          conditions: '',
          fields: ['count()'],
          aggregates: ['count()'],
          fieldAliases: [],
          columns: [] as string[],
          orderby: '',
          name: '',
        },
      ],
    };

    // Default behaviour for dashboard create limit wrapper
    mockDashboardCreateLimitWrapper.mockImplementation(({children}: {children: any}) =>
      typeof children === 'function'
        ? children({
            hasReachedDashboardLimit: false,
            dashboardsLimit: 0,
            isLoading: false,
            limitMessage: null,
          })
        : children
    );

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {...testDashboardListItem, widgetDisplay: [DisplayType.AREA]},
        {
          ...testDashboardListItem,
          title: 'Other Dashboard',
          id: '2',
          widgetDisplay: [DisplayType.AREA],
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      body: testDashboard,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });

    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders with the widget title and description', async () => {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    expect(screen.getByText('Test title')).toBeInTheDocument();
    expect(screen.getByText('Select Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText(
        /This is a preview of how the widget will appear in your dashboard./
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Add + Stay on this Page'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Open in Widget Builder'})).toBeDisabled();
  });

  it('enables the buttons when a dashboard is selected', async () => {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    expect(screen.getByRole('button', {name: 'Add + Stay on this Page'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Open in Widget Builder'})).toBeDisabled();

    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    expect(screen.getByRole('button', {name: 'Add + Stay on this Page'})).toBeEnabled();
    expect(screen.getByRole('button', {name: 'Open in Widget Builder'})).toBeEnabled();
  });

  it('includes a New Dashboard option in the selector with saved dashboards', async () => {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    await selectEvent.openMenu(screen.getByText('Select Dashboard'));
    expect(screen.getByText('+ Create New Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
  });

  it('applies dashboard saved filters to visualization', async () => {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          project: [],
          interval: '5m',
          orderby: '',
          statsPeriod: '24h',
          yAxis: ['count()'],
        }),
      })
    );

    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    expect(eventsStatsMock).toHaveBeenLastCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          interval: '1m',
          orderby: '',
          partial: '1',
          project: [1],
          query: ' release:"abc@v1.2.0" ',
          statsPeriod: '1h',
          yAxis: ['count()'],
        }),
      })
    );
  });

  it('calls the events stats endpoint with the query and selection values', async () => {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          environment: [],
          project: [],
          interval: '5m',
          orderby: '',
          statsPeriod: '24h',
          yAxis: ['count()'],
        }),
      })
    );
  });

  it('navigates to the widget builder when clicking Open in Widget Builder', async () => {
    const {router} = render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        source={DashboardWidgetSource.DISCOVERV2}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    await userEvent.click(screen.getByText('Open in Widget Builder'));
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/dashboard/1/widget-builder/widget/new/'
    );
    expect(router.location.query).toEqual({
      title: 'Test title',
      description: 'Test description',
      dataset: 'error-events',
      source: DashboardWidgetSource.DISCOVERV2,
      project: '1',
      statsPeriod: '1h',
      displayType: 'line',
      legendAlias: '',
      query: '',
      sort: '',
      yAxis: 'count()',
    });
  });

  it('navigates to the widget builder with saved filters', async () => {
    const {router} = render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        source={DashboardWidgetSource.DISCOVERV2}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    await userEvent.click(screen.getByText('Open in Widget Builder'));

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/dashboard/1/widget-builder/widget/new/'
    );
    expect(router.location.query).toEqual({
      title: 'Test title',
      description: 'Test description',
      query: '',
      yAxis: 'count()',
      sort: '',
      displayType: DisplayType.LINE,
      dataset: WidgetType.ERRORS,
      project: '1',
      legendAlias: '',
      statsPeriod: '1h',
      source: DashboardWidgetSource.DISCOVERV2,
    });
  });

  it('updates the selected dashboard with the widget when clicking Add + Stay in Discover', async () => {
    const dashboardDetailGetMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      body: {id: '1', widgets: []},
    });
    const dashboardDetailPutMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      body: {},
    });
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[{...widget, widgetType: WidgetType.ERRORS}]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    await userEvent.click(screen.getByText('Add + Stay on this Page'));
    expect(dashboardDetailGetMock).toHaveBeenCalled();

    // mocked widgets response is an empty array, assert this new widget
    // is sent as an update to the dashboard
    await waitFor(() => {
      expect(dashboardDetailPutMock).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            widgets: [
              {...widget, widgetType: WidgetType.ERRORS, layout: expect.any(Object)},
            ],
          }),
        })
      );
    });
  });

  it('clears sort when clicking Add + Stay in Discover with line chart', async () => {
    const dashboardDetailGetMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      body: {id: '1', widgets: []},
    });
    const dashboardDetailPutMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      body: {},
    });
    widget = {
      ...widget,
      queries: [
        {
          conditions: '',
          fields: ['count()'],
          aggregates: ['count()'],
          fieldAliases: [],
          columns: [],
          orderby: '-project',
          name: '',
        },
      ],
    };
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    await userEvent.click(screen.getByText('Add + Stay on this Page'));
    expect(dashboardDetailGetMock).toHaveBeenCalled();

    // mocked widgets response is an empty array, assert this new widget
    // is sent as an update to the dashboard
    await waitFor(() => {
      expect(dashboardDetailPutMock).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            widgets: [
              {
                description: 'Test description',
                displayType: 'line',
                interval: '5m',
                queries: [
                  {
                    aggregates: ['count()'],
                    columns: [],
                    conditions: '',
                    fieldAliases: [],
                    fields: ['count()'],
                    name: '',
                    orderby: '',
                  },
                ],
                title: 'Test title',
                layout: expect.any(Object),
              },
            ],
          }),
        })
      );
    });
  });

  it('saves sort when clicking Add + Stay in Discover with top period chart', async () => {
    const dashboardDetailGetMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      body: {id: '1', widgets: []},
    });
    const dashboardDetailPutMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/1/',
      method: 'PUT',
      body: {},
    });
    widget = {
      ...widget,
      displayType: DisplayType.AREA,
      queries: [
        {
          conditions: '',
          fields: ['count()'],
          aggregates: ['count()'],
          fieldAliases: [],
          columns: ['project'],
          orderby: '-project',
          name: '',
        },
      ],
    };
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    await userEvent.click(screen.getByText('Add + Stay on this Page'));
    expect(dashboardDetailGetMock).toHaveBeenCalled();

    // mocked widgets response is an empty array, assert this new widget
    // is sent as an update to the dashboard
    await waitFor(() => {
      expect(dashboardDetailPutMock).toHaveBeenCalledWith(
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          data: expect.objectContaining({
            widgets: [
              {
                description: 'Test description',
                displayType: 'area',
                interval: '5m',
                limit: 5,
                queries: [
                  {
                    aggregates: ['count()'],
                    columns: ['project'],
                    conditions: '',
                    fieldAliases: [],
                    fields: ['count()'],
                    name: '',
                    orderby: '-project',
                  },
                ],
                title: 'Test title',
                layout: expect.any(Object),
              },
            ],
          }),
        })
      );
    });
  });

  it('disables Add + Stay in Discover when a new dashboard is selected', async () => {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(
      screen.getByText('Select Dashboard'),
      '+ Create New Dashboard'
    );

    expect(screen.getByRole('button', {name: 'Add + Stay on this Page'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Open in Widget Builder'})).toBeEnabled();
  });

  it('does not show the current dashboard in the list of options', async () => {
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture({pathname: '/organizations/org-slug/dashboard/1/'})}
      />,
      {
        initialRouterConfig: {
          route: '/organizations/:orgId/dashboard/:dashboardId/',
          location: {
            pathname: '/organizations/org-slug/dashboard/1/',
          },
        },
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    await userEvent.click(screen.getByText('Select Dashboard'));
    expect(screen.getByText('Other Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Test Dashboard')).not.toBeInTheDocument();
  });

  it('disables "Create New Dashboard" option when dashboard limit is reached', async () => {
    // Override the mock for this specific test
    mockDashboardCreateLimitWrapper.mockImplementation(({children}: {children: any}) =>
      typeof children === 'function'
        ? children({
            hasReachedDashboardLimit: true,
            dashboardsLimit: 5,
            isLoading: false,
            limitMessage:
              'You have reached the dashboard limit (5) for your plan. Upgrade to create more dashboards.',
          })
        : children
    );

    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });

    // Open the dropdown to see the options
    await selectEvent.openMenu(screen.getByText('Select Dashboard'));

    // Check that "Create New Dashboard" option exists but is disabled
    const createNewOption = await screen.findByRole('menuitemradio', {
      name: '+ Create New Dashboard',
    });
    expect(createNewOption).toBeInTheDocument();
    expect(createNewOption).toHaveAttribute('aria-disabled', 'true');

    await userEvent.hover(screen.getByText('+ Create New Dashboard'));
    expect(
      await screen.findByText(
        'You have reached the dashboard limit (5) for your plan. Upgrade to create more dashboards.'
      )
    ).toBeInTheDocument();
  });

  it('does not show prebuilt dashboards in the list of options', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [
        {...testDashboardListItem, widgetDisplay: [DisplayType.AREA]},
        {
          ...testDashboardListItem,
          title: 'Other Dashboard',
          id: '2',
          widgetDisplay: [DisplayType.AREA],
        },
        {
          ...testDashboardListItem,
          title: 'Prebuilt Dashboard',
          id: '3',
          widgetDisplay: [DisplayType.AREA],
          prebuiltId: 1,
        },
      ],
    });
    render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={defaultSelection}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.openMenu(screen.getByText('Select Dashboard'));
    expect(screen.queryByText('Prebuilt Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Test Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Other Dashboard')).toBeInTheDocument();
  });

  it('preserves user page filters when creating a new dashboard', async () => {
    const customSelection = {
      projects: [2, 3],
      environments: ['production', 'staging'],
      datetime: {
        start: null,
        end: null,
        period: '7d',
        utc: false,
      },
    };

    const {router} = render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={customSelection}
        source={DashboardWidgetSource.DISCOVERV2}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(
      screen.getByText('Select Dashboard'),
      '+ Create New Dashboard'
    );

    await userEvent.click(screen.getByText('Open in Widget Builder'));

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/dashboards/new/widget-builder/widget/new/'
    );
    expect(router.location.query).toEqual({
      title: 'Test title',
      description: 'Test description',
      query: '',
      yAxis: 'count()',
      sort: '',
      displayType: DisplayType.LINE,
      dataset: WidgetType.ERRORS,
      legendAlias: '',
      source: DashboardWidgetSource.DISCOVERV2,
      // User's page filters should be preserved
      project: ['2', '3'],
      environment: ['production', 'staging'],
      statsPeriod: '7d',
    });
  });

  it('uses dashboard saved filters when adding to existing dashboard', async () => {
    const customSelection = {
      projects: [2, 3],
      environments: ['production', 'staging'],
      datetime: {
        start: null,
        end: null,
        period: '7d',
        utc: false,
      },
    };

    const {router} = render(
      <AddToDashboardModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        organization={initialData.organization}
        widgets={[widget]}
        selection={customSelection}
        source={DashboardWidgetSource.DISCOVERV2}
        location={LocationFixture()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Dashboard')).toBeEnabled();
    });
    await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

    await userEvent.click(screen.getByText('Open in Widget Builder'));

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/dashboard/1/widget-builder/widget/new/'
    );
    expect(router.location.query).toEqual({
      title: 'Test title',
      description: 'Test description',
      query: '',
      yAxis: 'count()',
      sort: '',
      displayType: DisplayType.LINE,
      dataset: WidgetType.ERRORS,
      legendAlias: '',
      source: DashboardWidgetSource.DISCOVERV2,
      // Dashboard's saved filters should be used, not user's selection
      project: '1',
      statsPeriod: '1h',
    });
  });

  describe('multiple widgets', () => {
    let multipleWidgets: [Widget, Widget];

    beforeEach(() => {
      multipleWidgets = [
        {
          title: 'Widget 1',
          description: 'First widget',
          displayType: DisplayType.LINE,
          interval: '5m',
          queries: [
            {
              conditions: '',
              fields: ['count()'],
              aggregates: ['count()'],
              fieldAliases: [],
              columns: [] as string[],
              orderby: '',
              name: '',
            },
          ],
        },
        {
          title: 'Widget 2',
          description: 'Second widget',
          displayType: DisplayType.AREA,
          interval: '5m',
          queries: [
            {
              conditions: '',
              fields: ['p95(transaction.duration)'],
              aggregates: ['p95(transaction.duration)'],
              fieldAliases: [],
              columns: [] as string[],
              orderby: '',
              name: '',
            },
          ],
        },
      ];
    });

    it('hides widget name input when multiple widgets are provided', async () => {
      render(
        <AddToDashboardModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widgets={multipleWidgets}
          selection={defaultSelection}
          location={LocationFixture()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select Dashboard')).toBeEnabled();
      });

      // Widget name input should not be present
      expect(screen.queryByLabelText('Optional Widget Name')).not.toBeInTheDocument();
    });

    it('hides widget preview when multiple widgets are provided', async () => {
      render(
        <AddToDashboardModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widgets={multipleWidgets}
          selection={defaultSelection}
          location={LocationFixture()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select Dashboard')).toBeEnabled();
      });

      // Widget preview message should not be present
      expect(
        screen.queryByText(
          /This is a preview of how the widget will appear in your dashboard./
        )
      ).not.toBeInTheDocument();
    });

    it('shows message about adding multiple widgets', async () => {
      render(
        <AddToDashboardModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widgets={multipleWidgets}
          selection={defaultSelection}
          location={LocationFixture()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select Dashboard')).toBeEnabled();
      });

      // Should show message about adding multiple widgets with full text
      expect(
        screen.getByText(
          /Adding 2 widgets to the selected dashboard\. Any conflicting filters from these queries will be overridden by Dashboard filters\./
        )
      ).toBeInTheDocument();
    });

    it('shows "Add + Open Dashboard" button for multiple widgets', async () => {
      render(
        <AddToDashboardModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widgets={multipleWidgets}
          selection={defaultSelection}
          actions={['add-and-stay-on-current-page', 'add-and-open-dashboard']}
          location={LocationFixture()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select Dashboard')).toBeEnabled();
      });

      // Should show "Add + Open Dashboard" button
      expect(
        screen.getByRole('button', {name: 'Add + Open Dashboard'})
      ).toBeInTheDocument();
      // Should not show "Open in Widget Builder" for multiple widgets
      expect(
        screen.queryByRole('button', {name: 'Open in Widget Builder'})
      ).not.toBeInTheDocument();
    });

    it('adds multiple widgets to existing dashboard', async () => {
      const dashboardDetailGetMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        body: {id: '1', widgets: []},
      });
      const dashboardDetailPutMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: {},
      });

      const {router} = render(
        <AddToDashboardModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widgets={multipleWidgets}
          selection={defaultSelection}
          actions={['add-and-stay-on-current-page', 'add-and-open-dashboard']}
          location={LocationFixture()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select Dashboard')).toBeEnabled();
      });
      await selectEvent.select(screen.getByText('Select Dashboard'), 'Test Dashboard');

      await userEvent.click(screen.getByText('Add + Open Dashboard'));
      expect(dashboardDetailGetMock).toHaveBeenCalled();

      // Assert both widgets are sent as an update to the dashboard
      await waitFor(() => {
        expect(dashboardDetailPutMock).toHaveBeenCalledWith(
          '/organizations/org-slug/dashboards/1/',
          expect.objectContaining({
            data: expect.objectContaining({
              widgets: [
                expect.objectContaining({
                  title: 'Widget 1',
                  description: 'First widget',
                  displayType: DisplayType.LINE,
                }),
                expect.objectContaining({
                  title: 'Widget 2',
                  description: 'Second widget',
                  displayType: DisplayType.AREA,
                }),
              ],
            }),
          })
        );
      });

      // Should navigate to the dashboard after adding
      expect(router.location.pathname).toBe('/organizations/org-slug/dashboard/1/');
    });

    it('navigates to new dashboard with multiple widgets in location state', async () => {
      const {router} = render(
        <AddToDashboardModal
          Header={stubEl}
          Footer={stubEl as ModalRenderProps['Footer']}
          Body={stubEl as ModalRenderProps['Body']}
          CloseButton={stubEl}
          closeModal={() => undefined}
          organization={initialData.organization}
          widgets={multipleWidgets}
          selection={defaultSelection}
          actions={['add-and-stay-on-current-page', 'add-and-open-dashboard']}
          source={DashboardWidgetSource.TRACEMETRICS}
          location={LocationFixture()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('Select Dashboard')).toBeEnabled();
      });
      await selectEvent.select(
        screen.getByText('Select Dashboard'),
        '+ Create New Dashboard'
      );

      await userEvent.click(screen.getByText('Add + Open Dashboard'));

      // Should navigate to dashboard create page
      expect(router.location.pathname).toBe('/organizations/org-slug/dashboards/new/');

      // Should pass widgets via location state
      expect(router.location.state?.widgets).toHaveLength(2);

      // Check first widget has required properties
      expect(router.location.state?.widgets[0]).toMatchObject({
        title: 'Widget 1',
        displayType: DisplayType.LINE,
      });
      expect(router.location.state?.widgets[0]?.tempId).toBeDefined();
      expect(router.location.state?.widgets[0]?.layout).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
        w: expect.any(Number),
        h: expect.any(Number),
        minH: expect.any(Number),
      });

      // Check second widget has required properties
      expect(router.location.state?.widgets[1]).toMatchObject({
        title: 'Widget 2',
        displayType: DisplayType.AREA,
      });
      expect(router.location.state?.widgets[1]?.tempId).toBeDefined();
      expect(router.location.state?.widgets[1]?.layout).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
        w: expect.any(Number),
        h: expect.any(Number),
        minH: expect.any(Number),
      });
    });
  });
});
