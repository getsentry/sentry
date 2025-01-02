import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {WidgetFixture} from 'sentry-fixture/widget';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import * as LineChart from 'sentry/components/charts/lineChart';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import {DatasetSource} from 'sentry/utils/discover/types';
import {MINUTE, SECOND} from 'sentry/utils/formatters';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import ReleaseWidgetQueries from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';

import WidgetLegendSelectionState from '../widgetLegendSelectionState';

import {DashboardsMEPProvider} from './dashboardsMEPContext';

jest.mock('sentry/components/charts/simpleTableChart', () => jest.fn(() => <div />));
jest.mock('sentry/views/dashboards/widgetCard/releaseWidgetQueries');

describe('Dashboards > WidgetCard', function () {
  const {router, organization} = initializeOrg({
    organization: OrganizationFixture({
      features: ['dashboards-edit', 'discover-basic'],
    }),
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);

  const renderWithProviders = (component: React.ReactNode) =>
    render(
      <DashboardsMEPProvider>
        <MEPSettingProvider forceTransactions={false}>{component}</MEPSettingProvider>
      </DashboardsMEPProvider>,
      {organization, router}
    );

  const multipleQueryWidget: Widget = {
    title: 'Errors',
    description: 'Valid widget description',
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

  const api = new MockApiClient();
  let eventsMock: jest.Mock;

  const widgetLegendState = new WidgetLegendSelectionState({
    location: LocationFixture(),
    dashboard: DashboardFixture([multipleQueryWidget]),
    organization,
    router,
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {meta: {isMetricsData: false}},
    });
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {fields: {title: 'string'}},
        data: [{title: 'title'}],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
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
        widget={multipleQueryWidget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Open in Discover'}));
    expect(spy).toHaveBeenCalledWith({
      isMetricsData: false,
      organization,
      widget: multipleQueryWidget,
    });
  });

  it('renders with Open in Discover button', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{...multipleQueryWidget, queries: [multipleQueryWidget.queries[0]!]}}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByRole('link', {name: 'Open in Discover'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?environment=prod&field=count%28%29&field=failure_count%28%29&name=Errors&project=1&query=event.type%3Aerror&statsPeriod=14d&yAxis=count%28%29&yAxis=failure_count%28%29'
    );
  });

  it('renders widget description in dashboard', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={multipleQueryWidget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.hover(await screen.findByLabelText('Widget description'));
    expect(await screen.findByText('Valid widget description')).toBeInTheDocument();
  });

  it('renders Discover button with prepended fields pulled from equations', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{
          ...multipleQueryWidget,
          queries: [
            {
              ...multipleQueryWidget.queries[0]!,
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
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByRole('link', {name: 'Open in Discover'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?environment=prod&field=count_if%28transaction.duration%2Cequals%2C300%29&field=failure_count%28%29&field=count%28%29&field=equation%7C%28count%28%29%20%2B%20failure_count%28%29%29%20%2F%20count_if%28transaction.duration%2Cequals%2C300%29&name=Errors&project=1&query=event.type%3Aerror&statsPeriod=14d&yAxis=equation%7C%28count%28%29%20%2B%20failure_count%28%29%29%20%2F%20count_if%28transaction.duration%2Cequals%2C300%29'
    );
  });

  it('renders button to open Discover with Top N', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.TOP_N,
          queries: [
            {
              ...multipleQueryWidget.queries[0]!,
              fields: ['transaction', 'count()'],
              columns: ['transaction'],
              aggregates: ['count()'],
            },
          ],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByRole('link', {name: 'Open in Discover'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?display=top5&environment=prod&field=transaction&field=count%28%29&name=Errors&project=1&query=event.type%3Aerror&statsPeriod=14d&yAxis=count%28%29'
    );
  });

  it('allows Open in Discover when the widget contains custom measurements', async function () {
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.LINE,
          queries: [
            {
              ...multipleQueryWidget.queries[0]!,
              conditions: '',
              fields: [],
              columns: [],
              aggregates: ['p99(measurements.custom.measurement)'],
            },
          ],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByRole('link', {name: 'Open in Discover'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/discover/results/?environment=prod&field=p99%28measurements.custom.measurement%29&name=Errors&project=1&query=&statsPeriod=14d&yAxis=p99%28measurements.custom.measurement%29'
    );
  });

  it('calls onDuplicate when Duplicate Widget is clicked', async function () {
    const mock = jest.fn();
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.AREA,
          queries: [{...multipleQueryWidget.queries[0]!, fields: ['count()']}],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={mock}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Duplicate Widget'}));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('does not add duplicate widgets if max widget is reached', async function () {
    const mock = jest.fn();
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.AREA,
          queries: [{...multipleQueryWidget.queries[0]!, fields: ['count()']}],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={mock}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLegendState={widgetLegendState}
        widgetLimitReached
      />
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Duplicate Widget'}));
    expect(mock).toHaveBeenCalledTimes(0);
  });

  it('calls onEdit when Edit Widget is clicked', async function () {
    const mock = jest.fn();
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.AREA,
          queries: [{...multipleQueryWidget.queries[0]!, fields: ['count()']}],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={mock}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Edit Widget'}));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('renders delete widget option', async function () {
    const mock = jest.fn();
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.AREA,
          queries: [{...multipleQueryWidget.queries[0]!, fields: ['count()']}],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={mock}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete Widget'}));
    // Confirm Modal
    renderGlobalModal();
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(mock).toHaveBeenCalled();
  });

  it('calls events with a limit of 20 items', async function () {
    const mock = jest.fn();

    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.TABLE,
          queries: [{...multipleQueryWidget.queries[0]!, fields: ['count()']}],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={mock}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        tableItemLimit={20}
        widgetLegendState={widgetLegendState}
      />
    );

    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 20,
          }),
        })
      );
    });
  });

  it('calls events with a default limit of 5 items', async function () {
    const mock = jest.fn();
    renderWithProviders(
      <WidgetCard
        api={api}
        widget={{
          ...multipleQueryWidget,
          displayType: DisplayType.TABLE,
          queries: [{...multipleQueryWidget.queries[0]!, fields: ['count()']}],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={mock}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );

    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            per_page: 5,
          }),
        })
      );
    });
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

    renderWithProviders(
      <WidgetCard
        api={api}
        widget={tableWidget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        tableItemLimit={20}
        widgetLegendState={widgetLegendState}
      />
    );

    await waitFor(() => expect(eventsMock).toHaveBeenCalled());

    await waitFor(() =>
      expect(SimpleTableChart).toHaveBeenCalledWith(
        expect.objectContaining({stickyHeaders: true}),
        expect.anything()
      )
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
        widget={widget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        tableItemLimit={20}
        widgetLegendState={widgetLegendState}
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
        widget={widget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        index="10"
        isPreview
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.click(await screen.findByLabelText('Open Full-Screen View'));
    expect(router.push).toHaveBeenCalledWith(
      expect.objectContaining({pathname: '/mock-pathname/widget/10/'})
    );
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
            p95_measurements_custom: 'millisecond',
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
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );
    await waitFor(function () {
      expect(eventsStatsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      const mockCall = spy.mock.calls?.at(-1)?.[0];
      expect(mockCall?.tooltip).toBeDefined();
    });
    const mockCall = spy.mock.calls?.at(-1)?.[0];
    // @ts-expect-error
    expect(mockCall?.yAxis.axisLabel.formatter(24, 'p95(measurements.custom)')).toEqual(
      '24ms'
    );
  });

  it('renders label in seconds when there is a transition from seconds to minutes in the y axis', async function () {
    const spy = jest.spyOn(LineChart, 'LineChart');
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [
            1658262600,
            [
              {
                count: 40 * SECOND,
              },
            ],
          ],
          [
            1658262601,
            [
              {
                count: 50 * SECOND,
              },
            ],
          ],
          [
            1658262602,
            [
              {
                count: MINUTE,
              },
            ],
          ],
          [
            1658262603,
            [
              {
                count: 1.3 * MINUTE,
              },
            ],
          ],
        ],
        meta: {
          fields: {
            time: 'date',
            p50_transaction_duration: 'duration',
          },
          units: {
            time: null,
            p50_transaction_duration: 'millisecond',
          },
          isMetricsData: false,
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
              aggregates: ['p50(transaction.duration)'],
              orderby: '',
            },
          ],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />
    );
    await waitFor(function () {
      expect(eventsStatsMock).toHaveBeenCalled();
    });
    await waitFor(() => {
      const mockCall = spy.mock.calls?.at(-1)?.[0];
      expect(mockCall?.yAxis).toBeDefined();
    });
    const mockCall = spy.mock.calls?.at(-1)?.[0];
    expect(
      // @ts-expect-error
      mockCall?.yAxis.axisLabel.formatter(60000, 'p50(transaction.duration)')
    ).toEqual('60s');
    // @ts-expect-error
    expect(mockCall?.yAxis?.minInterval).toEqual(SECOND);
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
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        isPreview
        widgetLegendState={widgetLegendState}
      />
    );

    expect(await screen.findByText('Indexed')).toBeInTheDocument();
  });

  it('displays the discover split warning icon when the dataset source is forced', async function () {
    const testWidget = {
      ...WidgetFixture(),
      datasetSource: DatasetSource.FORCED,
      widgetType: WidgetType.ERRORS,
    };

    renderWithProviders(
      <WidgetCard
        api={api}
        organization={organization}
        widget={testWidget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        isPreview
        widgetLegendState={widgetLegendState}
      />
    );

    await userEvent.hover(screen.getByLabelText('Widget warnings'));

    expect(
      await screen.findByText(/We're splitting our datasets up/)
    ).toBeInTheDocument();
  });
});
