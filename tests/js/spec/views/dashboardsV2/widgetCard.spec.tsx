import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import {DisplayType, Widget, WidgetType} from 'sentry/views/dashboardsV2/types';
import WidgetCard from 'sentry/views/dashboardsV2/widgetCard';
import MetricsWidgetQueries from 'sentry/views/dashboardsV2/widgetCard/metricsWidgetQueries';

jest.mock('sentry/components/charts/simpleTableChart');
jest.mock('sentry/views/dashboardsV2/widgetCard/metricsWidgetQueries');

describe('Dashboards > WidgetCard', function () {
  const {router, organization, routerContext} = initializeOrg({
    organization: TestStubs.Organization({
      features: ['dashboards-edit', 'discover-basic'],
      projects: [TestStubs.Project()],
    }),
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);

  const multipleQueryWidget: Widget = {
    title: 'Errors',
    interval: '5m',
    displayType: DisplayType.LINE,
    widgetType: WidgetType.DISCOVER,
    queries: [
      {
        conditions: 'event.type:error',
        fields: ['count()', 'failure_count()'],
        name: 'errors',
        orderby: '',
      },
      {
        conditions: 'event.type:default',
        fields: ['count()', 'failure_count()'],
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
  let eventsMock;

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-geo/',
      body: [],
    });
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {title: 'string'},
        data: [{title: 'title'}],
      },
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders with Open in Discover button and opens the Query Selector Modal when clicked', async function () {
    const spy = jest.spyOn(modal, 'openDashboardWidgetQuerySelectorModal');
    mountWithTheme(
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
      organization,
      widget: multipleQueryWidget,
    });
  });

  it('renders with Open in Discover button and opens in Discover when clicked', async function () {
    mountWithTheme(
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
      />,
      {context: routerContext}
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByRole('menuitemradio', {name: 'Open in Discover'}));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/results/?environment=prod&field=count%28%29&field=failure_count%28%29&name=Errors&project=1&query=event.type%3Aerror&statsPeriod=14d&yAxis=count%28%29&yAxis=failure_count%28%29'
    );
  });

  it('Opens in Discover with World Map', async function () {
    mountWithTheme(
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
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        isSorting={false}
        currentWidgetDragging={false}
        showContextMenu
        widgetLimitReached={false}
      />,
      {context: routerContext}
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByRole('menuitemradio', {name: 'Open in Discover'}));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/results/?display=worldmap&environment=prod&field=geo.country_code&field=count%28%29&name=Errors&project=1&query=event.type%3Aerror%20has%3Ageo.country_code&statsPeriod=14d&yAxis=count%28%29'
    );
  });

  it('Opens in Discover with prepended fields pulled from equations', async function () {
    mountWithTheme(
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
      />,
      {context: routerContext}
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByRole('menuitemradio', {name: 'Open in Discover'}));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/results/?environment=prod&field=count_if%28transaction.duration%2Cequals%2C300%29&field=failure_count%28%29&field=count%28%29&field=equation%7C%28count%28%29%20%2B%20failure_count%28%29%29%20%2F%20count_if%28transaction.duration%2Cequals%2C300%29&name=Errors&project=1&query=event.type%3Aerror&statsPeriod=14d&yAxis=equation%7C%28count%28%29%20%2B%20failure_count%28%29%29%20%2F%20count_if%28transaction.duration%2Cequals%2C300%29'
    );
  });

  it('Opens in Discover with Top N', async function () {
    mountWithTheme(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.TOP_N,
          queries: [
            {...multipleQueryWidget.queries[0], fields: ['transaction', 'count()']},
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
      />,
      {context: routerContext}
    );

    userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Open in Discover')).toBeInTheDocument();
    userEvent.click(screen.getByRole('menuitemradio', {name: 'Open in Discover'}));
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/discover/results/?display=top5&environment=prod&field=transaction&field=count%28%29&name=Errors&project=1&query=event.type%3Aerror&statsPeriod=14d&yAxis=count%28%29'
    );
  });

  it('calls onDuplicate when Duplicate Widget is clicked', async function () {
    const mock = jest.fn();
    mountWithTheme(
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
    mountWithTheme(
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
    mountWithTheme(
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
    mountWithTheme(
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
    mountWithTheme(
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
    expect(eventsMock).toHaveBeenCalledWith(
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
    mountWithTheme(
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
    expect(eventsMock).toHaveBeenCalledWith(
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
          name: 'Table',
          orderby: '',
        },
      ],
    };
    mountWithTheme(
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
    expect(SimpleTableChart).toHaveBeenCalledWith(
      expect.objectContaining({stickyHeaders: true}),
      expect.anything()
    );
  });

  it('calls metrics queries', function () {
    const widget: Widget = {
      title: 'Metrics Widget',
      interval: '5m',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.METRICS,
      queries: [],
    };
    mountWithTheme(
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

    expect(MetricsWidgetQueries).toHaveBeenCalledTimes(1);
  });

  it('opens the widget viewer modal when a widget has no id', async () => {
    const openWidgetViewerModal = jest.spyOn(modal, 'openWidgetViewerModal');
    const widget: Widget = {
      title: 'Widget',
      interval: '5m',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.DISCOVER,
      queries: [],
    };
    mountWithTheme(
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
      />
    );

    userEvent.click(await screen.findByLabelText('Open Widget Viewer'));
    expect(openWidgetViewerModal).toHaveBeenCalledWith(expect.objectContaining({widget}));
  });
});
