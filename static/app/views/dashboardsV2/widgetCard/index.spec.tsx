import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import * as LineChart from 'sentry/components/charts/lineChart';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';
import ReleaseWidgetQueries from 'sentry/views/dashboardsV2/widgetCard/releaseWidgetQueries';

jest.mock('sentry/components/charts/simpleTableChart');
jest.mock('sentry/views/dashboardsV2/widgetCard/releaseWidgetQueries');

describe('Dashboards > WidgetCard', function () {
  const {router, organization, routerContext} = initializeOrg({
    organization: TestStubs.Organization({
      features: ['dashboards-edit', 'discover-basic'],
      projects: [TestStubs.Project()],
    }),
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);

  const renderWithProviders = component =>
    render(
      <MEPSettingProvider forceTransactions={false}>{component}</MEPSettingProvider>,
      {organization, router, context: routerContext}
    );

  const multipleQueryWidget: Widget = {
    title: 'Errors',
    interval: '5m',
    displayType: DisplayType.LINE,
    widgetType: WidgetType.DISCOVER,
    queries: [
      {
        conditions: 'event.type:error',
        fields: ['count()', 'failure_count()'],
        aggregates: ['count()', 'failure_count()'],
        columns: [],
        name: 'errors',
        orderby: '',
      },
      {
        conditions: 'event.type:default',
        fields: ['count()', 'failure_count()'],
        aggregates: ['count()', 'failure_count()'],
        columns: [],
        name: 'default',
        orderby: '',
      },
    ],
  };
  const selection = {
    projects: [1],
    environments: ['prod'],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: false,
    },
  };

  const api = new Client();
  let eventsv2Mock, eventsMock;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {meta: {isMetricsData: false}},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-geo/',
      body: {meta: {isMetricsData: false}},
    });
    eventsv2Mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {title: 'string'},
        data: [{title: 'title'}],
      },
    });
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {fields: {title: 'string'}},
        data: [{title: 'title'}],
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders with Open in Discover button and opens the Query Selector Modal when clicked', async function () {
    const spy = jest.spyOn(modal, 'openDashboardWidgetQuerySelectorModal');
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={multipleQueryWidget}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByText('Open in Discover'));
    expect(spy).toHaveBeenCalledWith({
      isMetricsData: false,
      organization,
      widget: multipleQueryWidget,
    });
  });

  it('renders with Open in Discover button and opens in Discover when clicked', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{...multipleQueryWidget, queries: [multipleQueryWidget.queries[0]]}}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByText('Open in Discover'));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/results/?environment=prod&field=count%28%29&field=failure_count%28%29&name=Errors&project=1&query=event.type%3Aerror&statsPeriod=14d&yAxis=count%28%29&yAxis=failure_count%28%29'
    );
  });

  it('Opens in Discover with World Map', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.WORLD_MAP,
          queries: [
            {
              ...multipleQueryWidget.queries[0],
              fields: ['count()'],
              aggregates: ['count()'],
              columns: [],
            },
          ],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByText('Open in Discover'));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/results/?display=worldmap&environment=prod&field=geo.country_code&field=count%28%29&name=Errors&project=1&query=event.type%3Aerror%20has%3Ageo.country_code&statsPeriod=14d&yAxis=count%28%29'
    );
  });

  it('Opens in Discover with prepended fields pulled from equations', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...multipleQueryWidget,
          queries: [
            {
              ...multipleQueryWidget.queries[0],
              fields: [
                'equation|(count() + failure_count()) / count_if(transaction.duration,equals,300)',
              ],
              columns: [],
              aggregates: [
                'equation|(count() + failure_count()) / count_if(transaction.duration,equals,300)',
              ],
            },
          ],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByText('Open in Discover'));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/results/?environment=prod&field=count_if%28transaction.duration%2Cequals%2C300%29&field=failure_count%28%29&field=count%28%29&field=equation%7C%28count%28%29%20%2B%20failure_count%28%29%29%20%2F%20count_if%28transaction.duration%2Cequals%2C300%29&name=Errors&project=1&query=event.type%3Aerror&statsPeriod=14d&yAxis=equation%7C%28count%28%29%20%2B%20failure_count%28%29%29%20%2F%20count_if%28transaction.duration%2Cequals%2C300%29'
    );
  });

  it('Opens in Discover with Top N', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.TOP_N,
          queries: [
            {
              ...multipleQueryWidget.queries[0],
              fields: ['transaction', 'count()'],
              columns: ['transaction'],
              aggregates: ['count()'],
            },
          ],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByText('Open in Discover'));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/results/?display=top5&environment=prod&field=transaction&field=count%28%29&name=Errors&project=1&query=event.type%3Aerror&statsPeriod=14d&yAxis=count%28%29'
    );
  });

  it('allows Open in Discover when the widget contains custom measurements', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.LINE,
          queries: [
            {
              ...multipleQueryWidget.queries[0],
              conditions: '',
              fields: [],
              columns: [],
              aggregates: ['p99(measurements.custom.measurement)'],
            },
          ],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByText('Open in Discover'));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/results/?environment=prod&field=p99%28measurements.custom.measurement%29&name=Errors&project=1&query=&statsPeriod=14d&yAxis=p99%28measurements.custom.measurement%29'
    );
  });

  it('calls onDuplicate when Duplicate Widget is clicked', async function () {
    const mock = jest.fn();
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.WORLD_MAP,
          queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={mock}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();
    userEvent.click(screen.getByText('Duplicate Widget'));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('does not add duplicate widgets if max widget is reached', async function () {
    const mock = jest.fn();
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.WORLD_MAP,
          queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={mock}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();
    userEvent.click(screen.getByText('Duplicate Widget'));
    expect(mock).toHaveBeenCalledTimes(0);
  });

  it('calls onEdit when Edit Widget is clicked', async function () {
    const mock = jest.fn();
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.WORLD_MAP,
          queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={mock}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Edit Widget')).toBeInTheDocument();
    userEvent.click(screen.getByText('Edit Widget'));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('renders delete widget option', async function () {
    const mock = jest.fn();
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.WORLD_MAP,
          queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
        }}
        selection={selection}
        isEditing={false}
        onDelete={mock}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Delete Widget')).toBeInTheDocument();
    userEvent.click(screen.getByText('Delete Widget'));
    // Confirm Modal
    await mountGlobalModal();
    await screen.findByRole('dialog');

    userEvent.click(screen.getByTestId('confirm-button'));

    expect(mock).toHaveBeenCalled();
  });

  it('calls eventsV2 with a limit of 20 items', async function () {
    const mock = jest.fn();
    await act(async () => {
      renderWithProviders(
        <WidgetCard
          api={api}
          organization={organization}
          widget={{
            ...multipleQueryWidget,
            displayType: DisplayType.TABLE,
            queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
          }}
          selection={selection}
          isEditing={false}
          onDelete={mock}
          onEdit={() => undefined}
          onDuplicate={() => undefined}
          renderErrorMessage={() => undefined}
          isSorting={false}
          currentWidgetDragging={false}
          showContextMenu
          widgetLimitReached={false}
          tableItemLimit={20}
        />
      );
      await tick();
    });
    expect(eventsv2Mock).toHaveBeenCalledWith(
      '/organizations/org-slug/eventsv2/',
      expect.objectContaining({
        query: expect.objectContaining({
          per_page: 20,
        }),
      })
    );
  });

  it('calls eventsV2 with a default limit of 5 items', async function () {
    const mock = jest.fn();
    await act(async () => {
      renderWithProviders(
        <WidgetCard
          api={api}
          organization={organization}
          widget={{
            ...multipleQueryWidget,
            displayType: DisplayType.TABLE,
            queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
          }}
          selection={selection}
          isEditing={false}
          onDelete={mock}
          onEdit={() => undefined}
          onDuplicate={() => undefined}
          renderErrorMessage={() => undefined}
          isSorting={false}
          currentWidgetDragging={false}
          showContextMenu
          widgetLimitReached={false}
        />
      );
      await tick();
    });
    expect(eventsv2Mock).toHaveBeenCalledWith(
      '/organizations/org-slug/eventsv2/',
      expect.objectContaining({
        query: expect.objectContaining({
          per_page: 5,
        }),
      })
    );
  });

  it('has sticky table headers', async function () {
    const tableWidget: Widget = {
      title: 'Table Widget',
      interval: '5m',
      displayType: DisplayType.TABLE,
      widgetType: WidgetType.DISCOVER,
      queries: [
        {
          conditions: '',
          fields: ['transaction', 'count()'],
          columns: ['transaction'],
          aggregates: ['count()'],
          name: 'Table',
          orderby: '',
        },
      ],
    };
    await act(async () => {
      renderWithProviders(
        <WidgetCard
          api={api}
          organization={organization}
          widget={tableWidget}
          selection={selection}
          isEditing={false}
          onDelete={() => undefined}
          onEdit={() => undefined}
          onDuplicate={() => undefined}
          renderErrorMessage={() => undefined}
          isSorting={false}
          currentWidgetDragging={false}
          showContextMenu
          widgetLimitReached={false}
          tableItemLimit={20}
        />
      );
      await tick();
    });
    await waitFor(() => expect(eventsv2Mock).toHaveBeenCalled());

    expect(SimpleTableChart).toHaveBeenCalledWith(
      expect.objectContaining({stickyHeaders: true}),
      expect.anything()
    );
  });

  it('calls release queries', function () {
    const widget: Widget = {
      title: 'Release Widget',
      interval: '5m',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.RELEASE,
      queries: [],
    };
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
        tableItemLimit={20}
      />
    );

    expect(ReleaseWidgetQueries).toHaveBeenCalledTimes(1);
  });

  it('opens the widget viewer modal when a widget has no id', async () => {
    const widget: Widget = {
      title: 'Widget',
      interval: '5m',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.DISCOVER,
      queries: [],
    };
    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
        showWidgetViewerButton
        index="10"
        isPreview
      />
    );

    userEvent.click(await screen.findByLabelText('Open Widget Viewer'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({pathname: '/mock-pathname/widget/10/'})
    );
  });

  it('renders stored data disclaimer', async function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {title: 'string', isMetricsData: false},
        data: [{title: 'title'}],
      },
    });

    renderWithProviders(
      <WidgetCard
        api={api}
        organization={{
          ...organization,
          features: [...organization.features, 'dashboards-mep'],
        }}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.TABLE,
          queries: [{...multipleQueryWidget.queries[0]}],
        }}
        selection={selection}
        isEditing={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
        showStoredAlert
      />
    );

    await waitFor(() => {
      // Badge in the widget header
      expect(screen.getByText('Indexed')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(
        // Alert below the widget
        screen.getByText(/we've automatically adjusted your results/i)
      ).toBeInTheDocument();
    });
  });

  describe('using events endpoint', () => {
    const organizationWithFlag = {
      ...organization,
      features: [...organization.features, 'discover-frontend-use-events-endpoint'],
    };

    it('calls eventsV2 with a limit of 20 items', async function () {
      const mock = jest.fn();
      await act(async () => {
        renderWithProviders(
          <WidgetCard
            api={api}
            organization={organizationWithFlag}
            widget={{
              ...multipleQueryWidget,
              displayType: DisplayType.TABLE,
              queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
            }}
            selection={selection}
            isEditing={false}
            onDelete={mock}
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            renderErrorMessage={() => undefined}
            isSorting={false}
            currentWidgetDragging={false}
            showContextMenu
            widgetLimitReached={false}
            tableItemLimit={20}
          />
        );
        await tick();
      });
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 20,
          }),
        })
      );
    });

    it('calls eventsV2 with a default limit of 5 items', async function () {
      const mock = jest.fn();
      await act(async () => {
        renderWithProviders(
          <WidgetCard
            api={api}
            organization={organizationWithFlag}
            widget={{
              ...multipleQueryWidget,
              displayType: DisplayType.TABLE,
              queries: [{...multipleQueryWidget.queries[0], fields: ['count()']}],
            }}
            selection={selection}
            isEditing={false}
            onDelete={mock}
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            renderErrorMessage={() => undefined}
            isSorting={false}
            currentWidgetDragging={false}
            showContextMenu
            widgetLimitReached={false}
          />
        );
        await tick();
      });
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 5,
          }),
        })
      );
    });

    it('has sticky table headers', async function () {
      const tableWidget: Widget = {
        title: 'Table Widget',
        interval: '5m',
        displayType: DisplayType.TABLE,
        widgetType: WidgetType.DISCOVER,
        queries: [
          {
            conditions: '',
            fields: ['transaction', 'count()'],
            columns: ['transaction'],
            aggregates: ['count()'],
            name: 'Table',
            orderby: '',
          },
        ],
      };
      await act(async () => {
        renderWithProviders(
          <WidgetCard
            api={api}
            organization={organizationWithFlag}
            widget={tableWidget}
            selection={selection}
            isEditing={false}
            onDelete={() => undefined}
            onEdit={() => undefined}
            onDuplicate={() => undefined}
            renderErrorMessage={() => undefined}
            isSorting={false}
            currentWidgetDragging={false}
            showContextMenu
            widgetLimitReached={false}
            tableItemLimit={20}
          />
        );
        await tick();
      });
      expect(SimpleTableChart).toHaveBeenCalledWith(
        expect.objectContaining({stickyHeaders: true}),
        expect.anything()
      );
    });

    it('renders stored data disclaimer', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        body: {
          meta: {fields: {title: 'string'}, isMetricsData: false},
          data: [{title: 'title'}],
        },
      });

      renderWithProviders(
        <WidgetCard
          api={api}
          organization={{
            ...organizationWithFlag,
            features: [...organizationWithFlag.features, 'dashboards-mep'],
          }}
          widget={{
            ...multipleQueryWidget,
            displayType: DisplayType.TABLE,
            queries: [{...multipleQueryWidget.queries[0]}],
          }}
          selection={selection}
          isEditing={false}
          onDelete={() => undefined}
          onEdit={() => undefined}
          onDuplicate={() => undefined}
          renderErrorMessage={() => undefined}
          isSorting={false}
          currentWidgetDragging={false}
          showContextMenu
          widgetLimitReached={false}
          showStoredAlert
        />
      );

      await waitFor(() => {
        // Badge in the widget header
        expect(screen.getByText('Indexed')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(
          // Alert below the widget
          screen.getByText(/we've automatically adjusted your results/i)
        ).toBeInTheDocument();
      });
    });

    it('renders chart using axis and tooltip formatters from custom measurement meta', async function () {
      const spy = jest.spyOn(LineChart, 'LineChart');
      const eventsStatsMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events-stats/',
        body: {
          data: [
            [
              1658262600,
              [
                {
                  count: 24,
                },
              ],
            ],
          ],
          meta: {
            fields: {
              time: 'date',
              p95_measurements_custom: 'duration',
            },
            units: {
              time: null,
              p95_measurements_custom: 'minute',
            },
            isMetricsData: true,
            tips: {},
          },
        },
      });

      renderWithProviders(
        <WidgetCard
          api={api}
          organization={organization}
          widget={{
            title: '',
            interval: '5m',
            widgetType: WidgetType.DISCOVER,
            displayType: DisplayType.LINE,
            queries: [
              {
                conditions: '',
                name: '',
                fields: [],
                columns: [],
                aggregates: ['p95(measurements.custom)'],
                orderby: '',
              },
            ],
          }}
          selection={selection}
          isEditing={false}
          onDelete={() => undefined}
          onEdit={() => undefined}
          onDuplicate={() => undefined}
          renderErrorMessage={() => undefined}
          isSorting={false}
          currentWidgetDragging={false}
          showContextMenu
          widgetLimitReached={false}
        />
      );
      await waitFor(function () {
        expect(eventsStatsMock).toHaveBeenCalled();
      });
      const {tooltip, yAxis} = spy.mock.calls.pop()?.[0] ?? {};
      expect(tooltip).toBeDefined();
      expect(yAxis).toBeDefined();
      // @ts-ignore
      expect(tooltip.valueFormatter(24, 'p95(measurements.custom)')).toEqual('24.00ms');
      // @ts-ignore
      expect(yAxis.axisLabel.formatter(24, 'p95(measurements.custom)')).toEqual('24ms');
    });

    it('displays indexed badge in preview mode', async function () {
      renderWithProviders(
        <WidgetCard
          api={api}
          organization={{
            ...organization,
            features: [...organization.features, 'dashboards-mep'],
          }}
          widget={multipleQueryWidget}
          selection={selection}
          isEditing={false}
          onDelete={() => undefined}
          onEdit={() => undefined}
          onDuplicate={() => undefined}
          renderErrorMessage={() => undefined}
          isSorting={false}
          currentWidgetDragging={false}
          showContextMenu
          widgetLimitReached={false}
          isPreview
        />
      );

      expect(await screen.findByText('Indexed')).toBeInTheDocument();
    });
  });
});
