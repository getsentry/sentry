import {EventsStatsFixture} from 'sentry-fixture/events';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import type {PageFilters} from 'sentry/types/core';
import {MetricsResultsMetaProvider} from 'sentry/utils/performance/contexts/metricsEnhancedPerformanceDataContext';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {DashboardFilterKeys, DisplayType} from 'sentry/views/dashboards/types';
import {WidgetQueryQueueProvider} from 'sentry/views/dashboards/utils/widgetQueryQueue';
import {
  DashboardsMEPContext,
  DashboardsMEPProvider,
} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import type {GenericWidgetQueriesResult} from 'sentry/views/dashboards/widgetCard/genericWidgetQueries';
import WidgetQueries from 'sentry/views/dashboards/widgetCard/widgetQueries';

describe('Dashboards > WidgetQueries', () => {
  const initialData = initializeOrg();

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });
  });

  const renderWithProviders = (component: React.ReactNode, options?: any) =>
    render(
      <MetricsResultsMetaProvider>
        <DashboardsMEPProvider>
          <MEPSettingProvider forceTransactions={false}>
            <WidgetQueryQueueProvider>{component}</WidgetQueryQueueProvider>
          </MEPSettingProvider>
        </DashboardsMEPProvider>
      </MetricsResultsMetaProvider>,
      options
    );

  const multipleQueryWidget = {
    title: 'Errors',
    interval: '5m',
    displayType: DisplayType.LINE,
    queries: [
      {
        conditions: 'event.type:error',
        fields: ['count()'],
        aggregates: ['count()'],
        columns: [],
        name: 'errors',
        orderby: '',
      },
      {
        conditions: 'event.type:default',
        fields: ['count()'],
        aggregates: ['count()'],
        columns: [],
        name: 'default',
        orderby: '',
      },
    ],
  };
  const singleQueryWidget = {
    title: 'Errors',
    interval: '5m',
    displayType: DisplayType.LINE,
    queries: [
      {
        conditions: 'event.type:error',
        fields: ['count()'],
        aggregates: ['count()'],
        columns: [],
        name: 'errors',
        orderby: '',
      },
    ],
  };
  const tableWidget = {
    title: 'SDK',
    interval: '5m',
    displayType: DisplayType.TABLE,
    queries: [
      {
        conditions: 'event.type:error',
        fields: ['sdk.name'],
        aggregates: [],
        columns: ['sdk.name'],
        name: 'sdk',
        orderby: '',
      },
    ],
  };
  const selection: PageFilters = {
    projects: [1],
    environments: ['prod'],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: false,
    },
  };

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('can send multiple API requests', async () => {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
      match: [MockApiClient.matchQuery({query: 'event.type:error'})],
    });
    const defaultMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
      match: [MockApiClient.matchQuery({query: 'event.type:default'})],
    });
    renderWithProviders(
      <WidgetQueries widget={multipleQueryWidget}>
        {() => <div data-test-id="child" />}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and 2 requests should be sent.
    await screen.findByTestId('child');
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(defaultMock).toHaveBeenCalledTimes(1);
  });

  it('appends dashboard filters to events series request', async () => {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    renderWithProviders(
      <WidgetQueries
        widget={singleQueryWidget}
        dashboardFilters={{[DashboardFilterKeys.RELEASE]: ['abc@1.2.0', 'abc@1.3.0']}}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    await screen.findByTestId('child');
    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: '(event.type:error) release:["abc@1.2.0","abc@1.3.0"] ',
        }),
      })
    );
  });

  it('appends dashboard filters to events table request', async () => {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
    });
    renderWithProviders(
      <WidgetQueries
        widget={tableWidget}
        dashboardFilters={{[DashboardFilterKeys.RELEASE]: ['abc@1.3.0']}}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    await screen.findByTestId('child');
    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: '(event.type:error) release:"abc@1.3.0" ',
        }),
      })
    );
  });

  it('sets errorMessage when the first request fails', async () => {
    const okMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      match: [MockApiClient.matchQuery({query: 'event.type:error'})],
      body: [],
    });
    const failMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      statusCode: 400,
      body: {detail: 'Bad request data'},
      match: [MockApiClient.matchQuery({query: 'event.type:default'})],
    });

    let error: string | undefined;
    renderWithProviders(
      <WidgetQueries widget={multipleQueryWidget}>
        {({errorMessage}: {errorMessage?: string}) => {
          error = errorMessage;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and 2 requests should be sent.
    expect(await screen.findByTestId('child')).toBeInTheDocument();
    await waitFor(() => {
      expect(error).toBe('Bad request data');
    });
    expect(okMock).toHaveBeenCalledTimes(1);
    expect(failMock).toHaveBeenCalledTimes(1);
  });

  it('adjusts interval based on date window', async () => {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const widget = {...singleQueryWidget, interval: '1m'};

    const longSelection: PageFilters = {
      projects: [1],
      environments: ['prod', 'dev'],
      datetime: {
        period: '90d',
        start: null,
        end: null,
        utc: false,
      },
    };

    // Initialize PageFiltersStore with the specific selection for this test
    PageFiltersStore.onInitializeUrlState(longSelection);

    renderWithProviders(
      <WidgetQueries widget={widget}>{() => <div data-test-id="child" />}</WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and interval bumped up.
    await screen.findByTestId('child');
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          interval: '4h',
          statsPeriod: '90d',
          environment: ['prod', 'dev'],
          project: [1],
        }),
      })
    );
  });

  it('adjusts interval based on date window 14d', async () => {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const widget = {...singleQueryWidget, interval: '1m'};

    renderWithProviders(
      <WidgetQueries widget={widget}>{() => <div data-test-id="child" />}</WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and interval bumped up.
    await screen.findByTestId('child');
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({interval: '30m'}),
      })
    );
  });

  it('can send table result queries', async () => {
    const tableMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {'sdk.name': 'string'},
        data: [{'sdk.name': 'python'}],
      },
    });

    // Initialize PageFiltersStore with selection
    PageFiltersStore.onInitializeUrlState(selection);

    let childProps: GenericWidgetQueriesResult | undefined;
    renderWithProviders(
      <WidgetQueries widget={tableWidget}>
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and 1 requests should be sent.
    await screen.findByTestId('child');
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(tableMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'event.type:error',
          field: 'sdk.name',
          statsPeriod: '14d',
          environment: 'prod',
          project: '1',
        }),
      })
    );
    expect(childProps?.timeseriesResults).toBeUndefined();
    await waitFor(() => expect(childProps?.tableResults?.[0]!.data).toHaveLength(1));
    expect(childProps?.tableResults?.[0]!.meta).toBeDefined();
  });

  it('can send multiple table queries', async () => {
    const firstQuery = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {'sdk.name': 'string'},
        data: [{'sdk.name': 'python'}],
      },
      match: [MockApiClient.matchQuery({query: 'event.type:error'})],
    });
    const secondQuery = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {title: 'string'},
        data: [{title: 'ValueError'}],
      },
      match: [MockApiClient.matchQuery({query: 'title:ValueError'})],
    });

    const widget = {
      title: 'SDK',
      interval: '5m',
      displayType: DisplayType.TABLE,
      queries: [
        {
          conditions: 'event.type:error',
          fields: ['sdk.name'],
          aggregates: [],
          columns: ['sdk.name'],
          name: 'sdk',
          orderby: '',
        },
        {
          conditions: 'title:ValueError',
          fields: ['title'],
          aggregates: [],
          columns: ['sdk.name'],
          name: 'title',
          orderby: '',
        },
      ],
    };

    let childProps: GenericWidgetQueriesResult | undefined;
    renderWithProviders(
      <WidgetQueries widget={widget}>
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and 2 requests should be sent.
    await screen.findByTestId('child');
    expect(firstQuery).toHaveBeenCalledTimes(1);
    expect(secondQuery).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(childProps?.tableResults).toHaveLength(2));
    expect(childProps?.tableResults?.[0]!.data[0]!['sdk.name']).toBeDefined();
    expect(childProps?.tableResults?.[1]!.data[0]!.title).toBeDefined();
  });

  it('can send big number result queries', async () => {
    const tableMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {'sdk.name': 'string'},
        data: [{'sdk.name': 'python'}],
      },
    });

    // Initialize PageFiltersStore with selection
    PageFiltersStore.onInitializeUrlState(selection);

    let childProps: GenericWidgetQueriesResult | undefined;
    renderWithProviders(
      <WidgetQueries
        widget={{
          title: 'SDK',
          interval: '5m',
          displayType: DisplayType.BIG_NUMBER,
          queries: [
            {
              conditions: 'event.type:error',
              fields: ['sdk.name'],
              aggregates: [],
              columns: ['sdk.name'],
              name: 'sdk',
              orderby: '',
            },
          ],
        }}
      >
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and 1 requests should be sent.
    await screen.findByTestId('child');
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(tableMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          referrer: 'api.dashboards.bignumberwidget',
          query: 'event.type:error',
          field: 'sdk.name',
          statsPeriod: '14d',
          environment: 'prod',
          project: '1',
        }),
      })
    );
    expect(childProps?.timeseriesResults).toBeUndefined();
    await waitFor(() => expect(childProps?.tableResults?.[0]?.data).toHaveLength(1));
    expect(childProps?.tableResults?.[0]?.meta).toBeDefined();
  });

  it('stops loading state once all queries finish even if some fail', async () => {
    const firstQuery = MockApiClient.addMockResponse({
      statusCode: 500,
      url: '/organizations/org-slug/events/',
      body: {detail: 'it didnt work'},
      match: [MockApiClient.matchQuery({query: 'event.type:error'})],
    });
    const secondQuery = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {title: 'string'},
        data: [{title: 'ValueError'}],
      },
      match: [MockApiClient.matchQuery({query: 'title:ValueError'})],
    });

    const widget = {
      title: 'SDK',
      interval: '5m',
      displayType: DisplayType.TABLE,
      queries: [
        {
          conditions: 'event.type:error',
          fields: ['sdk.name'],
          aggregates: [],
          columns: ['sdk.name'],
          name: 'sdk',
          orderby: '',
        },
        {
          conditions: 'title:ValueError',
          fields: ['sdk.name'],
          aggregates: [],
          columns: ['sdk.name'],
          name: 'title',
          orderby: '',
        },
      ],
    };

    let childProps: GenericWidgetQueriesResult | undefined;
    renderWithProviders(
      <WidgetQueries widget={widget}>
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and 2 requests should be sent.
    await screen.findByTestId('child');
    expect(firstQuery).toHaveBeenCalledTimes(1);
    expect(secondQuery).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(childProps?.loading).toBe(false));
  });

  it('sets bar charts to 1d interval', async () => {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
      match: [MockApiClient.matchQuery({interval: '1d'})],
    });
    const barWidget = {
      ...singleQueryWidget,
      displayType: DisplayType.BAR,
      // Should be ignored for bars.
      interval: '5m',
    };
    renderWithProviders(
      <WidgetQueries widget={barWidget}>
        {() => <div data-test-id="child" />}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and 1 requests should be sent.
    await screen.findByTestId('child');
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it('returns timeseriesResults in the same order as widgetQuery', async () => {
    MockApiClient.clearMockResponses();
    const defaultMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      body: {
        data: [
          [
            1000,
            [
              {
                count: 100,
              },
            ],
          ],
        ],
        start: 1000,
        end: 2000,
      },
      match: [MockApiClient.matchQuery({query: 'event.type:default'})],
    });
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      method: 'GET',
      body: {
        data: [
          [
            1000,
            [
              {
                count: 200,
              },
            ],
          ],
        ],
        start: 1000,
        end: 2000,
      },
      match: [MockApiClient.matchQuery({query: 'event.type:error'})],
    });
    const barWidget = {
      ...multipleQueryWidget,
      displayType: DisplayType.BAR,
      // Should be ignored for bars.
      interval: '5m',
    };
    const child = jest.fn(() => <div data-test-id="child" />);
    renderWithProviders(<WidgetQueries widget={barWidget}>{child}</WidgetQueries>, {
      organization: initialData.organization,
    });

    await screen.findByTestId('child');
    expect(defaultMock).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(child).toHaveBeenLastCalledWith(
        expect.objectContaining({
          timeseriesResults: [
            {data: [{name: 1000000, value: 200}], seriesName: 'errors : count()'},
            {data: [{name: 1000000, value: 100}], seriesName: 'default : count()'},
          ],
        })
      )
    );
  });

  it('calls events-stats with 4h interval when interval buckets would exceed 66', async () => {
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const areaWidget = {
      ...singleQueryWidget,
      displayType: DisplayType.AREA,
      interval: '5m',
    };

    const longSelection = {
      ...selection,
      datetime: {
        period: '90d',
        start: null,
        end: null,
        utc: false,
      },
    };

    // Initialize PageFiltersStore with longSelection
    PageFiltersStore.onInitializeUrlState(longSelection);

    renderWithProviders(
      <WidgetQueries widget={areaWidget}>
        {() => <div data-test-id="child" />}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    // Child should be rendered and 1 requests should be sent.
    await screen.findByTestId('child');
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({query: expect.objectContaining({interval: '4h'})})
    );
  });

  it('does not re-query events and sets name in widgets', async () => {
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: EventsStatsFixture(),
    });
    const lineWidget = {
      ...singleQueryWidget,
      displayType: DisplayType.LINE,
      interval: '5m',
    };
    let childProps!: GenericWidgetQueriesResult;
    const {rerender} = renderWithProviders(
      <WidgetQueries widget={lineWidget}>
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>,
      {organization: initialData.organization}
    );

    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(childProps.loading).toBe(false));

    // Simulate a re-render with a new query alias
    rerender(
      <MetricsResultsMetaProvider>
        <DashboardsMEPProvider>
          <MEPSettingProvider forceTransactions={false}>
            <WidgetQueryQueueProvider>
              <WidgetQueries
                widget={{
                  ...lineWidget,
                  queries: [
                    {
                      conditions: 'event.type:error',
                      fields: ['count()'],
                      aggregates: ['count()'],
                      columns: [],
                      name: 'this query alias changed',
                      orderby: '',
                    },
                  ],
                }}
              >
                {props => {
                  childProps = props;
                  return <div data-test-id="child" />;
                }}
              </WidgetQueries>
            </WidgetQueryQueueProvider>
          </MEPSettingProvider>
        </DashboardsMEPProvider>
      </MetricsResultsMetaProvider>
    );

    // Did not re-query
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(childProps.timeseriesResults![0]!.seriesName).toBe(
      'this query alias changed : count()'
    );
  });

  it('charts send metricsEnhanced requests', async () => {
    const {organization} = initialData;
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {
        data: [
          [
            1000,
            [
              {
                count: 100,
              },
            ],
          ],
        ],
        isMetricsData: false,
        start: 1000,
        end: 2000,
      },
    });
    const setIsMetricsMock = jest.fn();

    const children = jest.fn(() => <div />);

    renderWithProviders(
      <DashboardsMEPContext
        value={{
          isMetricsData: undefined,
          setIsMetricsData: setIsMetricsMock,
        }}
      >
        <WidgetQueries widget={singleQueryWidget}>{children}</WidgetQueries>
      </DashboardsMEPContext>,
      {
        organization: {
          ...organization,
          features: [...organization.features, 'dashboards-mep'],
        },
      }
    );

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'metricsEnhanced'}),
      })
    );

    await waitFor(() => {
      expect(setIsMetricsMock).toHaveBeenCalledWith(false);
    });
  });

  it('tables send metricsEnhanced requests', async () => {
    const {organization} = initialData;
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {title: 'string', isMetricsData: true},
        data: [{title: 'ValueError'}],
      },
    });
    const setIsMetricsMock = jest.fn();

    const children = jest.fn(() => <div />);

    renderWithProviders(
      <DashboardsMEPContext
        value={{
          isMetricsData: undefined,
          setIsMetricsData: setIsMetricsMock,
        }}
      >
        <WidgetQueries widget={{...singleQueryWidget, displayType: DisplayType.TABLE}}>
          {children}
        </WidgetQueries>
      </DashboardsMEPContext>,
      {
        organization: {
          ...organization,
          features: [...organization.features, 'dashboards-mep'],
        },
      }
    );

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({dataset: 'metricsEnhanced'}),
      })
    );

    await waitFor(() => {
      expect(setIsMetricsMock).toHaveBeenCalledWith(true);
    });
  });

  it('does not inject equation aliases for top N requests', async () => {
    const testData = initializeOrg({
      organization: {
        ...OrganizationFixture(),
      },
    });
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const areaWidget = {
      title: 'Errors',
      displayType: DisplayType.AREA,
      interval: '5m',
      queries: [
        {
          conditions: 'event.type:error',
          fields: [],
          aggregates: ['count()', 'equation|count() * 2'],
          columns: ['project'],
          orderby: 'equation[0]',
          name: '',
        },
      ],
    };
    renderWithProviders(
      <WidgetQueries widget={areaWidget}>
        {() => <div data-test-id="child" />}
      </WidgetQueries>,
      {organization: testData.organization}
    );

    // Child should be rendered and 1 requests should be sent.
    await screen.findByTestId('child');
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['project', 'count()', 'equation|count() * 2'],
          orderby: 'equation[0]',
        }),
      })
    );
  });
});
