import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import {DashboardFilterKeys} from 'sentry/views/dashboards/types';
import {DashboardsMEPContext} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import WidgetQueries, {
  flattenMultiSeriesDataWithGrouping,
} from 'sentry/views/dashboards/widgetCard/widgetQueries';

describe('Dashboards > WidgetQueries', function () {
  const initialData = initializeOrg();

  const renderWithProviders = component =>
    render(
      <MEPSettingProvider forceTransactions={false}>{component}</MEPSettingProvider>
    );

  const multipleQueryWidget = {
    title: 'Errors',
    interval: '5m',
    displayType: 'line',
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
    displayType: 'line',
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
    displayType: 'table',
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
  const selection = {
    projects: [1],
    environments: ['prod'],
    datetime: {
      period: '14d',
      orderby: '',
    },
  };

  const api = new Client();

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('can send multiple API requests', async function () {
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
      <WidgetQueries
        api={api}
        widget={multipleQueryWidget}
        organization={initialData.organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>
    );

    // Child should be rendered and 2 requests should be sent.
    await screen.findByTestId('child');
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(defaultMock).toHaveBeenCalledTimes(1);
  });

  it('appends dashboard filters to events series request', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={singleQueryWidget}
        organization={initialData.organization}
        selection={selection}
        dashboardFilters={{[DashboardFilterKeys.RELEASE]: ['abc@1.2.0', 'abc@1.3.0']}}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>
    );

    await screen.findByTestId('child');
    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'event.type:error release:[abc@1.2.0,abc@1.3.0] ',
        }),
      })
    );
  });

  it('appends dashboard filters to events table request', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
    });
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={tableWidget}
        organization={initialData.organization}
        selection={selection}
        dashboardFilters={{[DashboardFilterKeys.RELEASE]: ['abc@1.3.0']}}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>
    );

    await screen.findByTestId('child');
    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'event.type:error release:abc@1.3.0 ',
        }),
      })
    );
  });

  it('sets errorMessage when the first request fails', async function () {
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

    let error = '';
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={multipleQueryWidget}
        organization={initialData.organization}
        selection={selection}
      >
        {({errorMessage}) => {
          error = errorMessage;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>
    );

    // Child should be rendered and 2 requests should be sent.
    await screen.findByTestId('child');
    expect(okMock).toHaveBeenCalledTimes(1);
    expect(failMock).toHaveBeenCalledTimes(1);
    expect(error).toEqual('Bad request data');
  });

  it('adjusts interval based on date window', async function () {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const widget = {...singleQueryWidget, interval: '1m'};

    const longSelection = {
      projects: [1],
      environments: ['prod', 'dev'],
      datetime: {
        period: '90d',
      },
    };
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={widget}
        organization={initialData.organization}
        selection={longSelection}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>
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

  it('adjusts interval based on date window 14d', async function () {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const widget = {...singleQueryWidget, interval: '1m'};

    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={widget}
        organization={initialData.organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>
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

  it('can send table result queries', async function () {
    const tableMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {'sdk.name': 'string'},
        data: [{'sdk.name': 'python'}],
      },
    });

    let childProps = undefined;
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={tableWidget}
        organization={initialData.organization}
        selection={selection}
      >
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>
    );

    // Child should be rendered and 1 requests should be sent.
    await screen.findByTestId('child');
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(tableMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'event.type:error',
          field: ['sdk.name'],
          statsPeriod: '14d',
          environment: ['prod'],
          project: [1],
        }),
      })
    );
    expect(childProps.timeseriesResults).toBeUndefined();
    expect(childProps.tableResults[0].data).toHaveLength(1);
    expect(childProps.tableResults[0].meta).toBeDefined();
  });

  it('can send multiple table queries', async function () {
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
      displayType: 'table',
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

    let childProps = undefined;
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={widget}
        organization={initialData.organization}
        selection={selection}
      >
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>
    );

    // Child should be rendered and 2 requests should be sent.
    await screen.findByTestId('child');
    expect(firstQuery).toHaveBeenCalledTimes(1);
    expect(secondQuery).toHaveBeenCalledTimes(1);

    expect(childProps.tableResults).toHaveLength(2);
    expect(childProps.tableResults[0].data[0]['sdk.name']).toBeDefined();
    expect(childProps.tableResults[1].data[0].title).toBeDefined();
  });

  it('can send big number result queries', async function () {
    const tableMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: {
        meta: {'sdk.name': 'string'},
        data: [{'sdk.name': 'python'}],
      },
    });

    let childProps = undefined;
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={{
          title: 'SDK',
          interval: '5m',
          displayType: 'big_number',
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
        organization={initialData.organization}
        selection={selection}
      >
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>
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
          field: ['sdk.name'],
          statsPeriod: '14d',
          environment: ['prod'],
          project: [1],
        }),
      })
    );
    expect(childProps.timeseriesResults).toBeUndefined();
    expect(childProps.tableResults[0].data).toHaveLength(1);
    expect(childProps.tableResults[0].meta).toBeDefined();
  });

  it('can send world map result queries', async function () {
    const tableMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-geo/',
      body: {
        meta: {'sdk.name': 'string'},
        data: [{'sdk.name': 'python'}],
      },
    });

    let childProps = undefined;
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={{
          title: 'SDK',
          interval: '5m',
          displayType: 'world_map',
          queries: [
            {
              conditions: 'event.type:error',
              fields: ['count()'],
              aggregates: [],
              columns: ['count()'],
              name: 'sdk',
              orderby: '',
            },
          ],
        }}
        organization={initialData.organization}
        selection={selection}
      >
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>
    );

    // Child should be rendered and 1 requests should be sent.
    await screen.findByTestId('child');
    expect(tableMock).toHaveBeenCalledTimes(1);
    expect(tableMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-geo/',
      expect.objectContaining({
        query: expect.objectContaining({
          referrer: 'api.dashboards.worldmapwidget',
          query: 'event.type:error',
          field: ['count()'],
          statsPeriod: '14d',
          environment: ['prod'],
          project: [1],
        }),
      })
    );
    expect(childProps.timeseriesResults).toBeUndefined();
    expect(childProps.tableResults[0].data).toHaveLength(1);
    expect(childProps.tableResults[0].meta).toBeDefined();
  });

  it('stops loading state once all queries finish even if some fail', async function () {
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
      displayType: 'table',
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

    let childProps = undefined;
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={widget}
        organization={initialData.organization}
        selection={selection}
      >
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>
    );

    // Child should be rendered and 2 requests should be sent.
    await screen.findByTestId('child');
    expect(firstQuery).toHaveBeenCalledTimes(1);
    expect(secondQuery).toHaveBeenCalledTimes(1);

    expect(childProps.loading).toEqual(false);
  });

  it('sets bar charts to 1d interval', async function () {
    const errorMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
      match: [MockApiClient.matchQuery({interval: '1d'})],
    });
    const barWidget = {
      ...singleQueryWidget,
      displayType: 'bar',
      // Should be ignored for bars.
      interval: '5m',
    };
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={barWidget}
        organization={initialData.organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>
    );

    // Child should be rendered and 1 requests should be sent.
    await screen.findByTestId('child');
    expect(errorMock).toHaveBeenCalledTimes(1);
  });

  it('returns timeseriesResults in the same order as widgetQuery', async function () {
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
      displayType: 'bar',
      // Should be ignored for bars.
      interval: '5m',
    };
    const child = jest.fn(() => <div data-test-id="child" />);
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={barWidget}
        organization={initialData.organization}
        selection={selection}
      >
        {child}
      </WidgetQueries>
    );

    await screen.findByTestId('child');
    expect(defaultMock).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(child).toHaveBeenLastCalledWith(
      expect.objectContaining({
        timeseriesResults: [
          {data: [{name: 1000000, value: 200}], seriesName: 'errors : count()'},
          {data: [{name: 1000000, value: 100}], seriesName: 'default : count()'},
        ],
      })
    );
  });

  it('calls events-stats with 4h interval when interval buckets would exceed 66', async function () {
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const areaWidget = {
      ...singleQueryWidget,
      displayType: 'area',
      interval: '5m',
    };
    renderWithProviders(
      <WidgetQueries
        api={api}
        widget={areaWidget}
        organization={initialData.organization}
        selection={{
          ...selection,
          datetime: {
            period: '90d',
          },
        }}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>
    );

    // Child should be rendered and 1 requests should be sent.
    await screen.findByTestId('child');
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(eventsStatsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/events-stats/',
      expect.objectContaining({query: expect.objectContaining({interval: '4h'})})
    );
  });

  it('does not re-query events and sets name in widgets', async function () {
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: TestStubs.EventsStats(),
    });
    const lineWidget = {
      ...singleQueryWidget,
      displayType: 'line',
      interval: '5m',
    };
    let childProps;
    const {rerender} = renderWithProviders(
      <WidgetQueries
        api={api}
        widget={lineWidget}
        organization={initialData.organization}
        selection={selection}
      >
        {props => {
          childProps = props;
          return <div data-test-id="child" />;
        }}
      </WidgetQueries>
    );

    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(childProps.loading).toEqual(false));

    // Simulate a re-render with a new query alias
    rerender(
      <MEPSettingProvider forceTransactions={false}>
        <WidgetQueries
          api={api}
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
          organization={initialData.organization}
          selection={selection}
        >
          {props => {
            childProps = props;
            return <div data-test-id="child" />;
          }}
        </WidgetQueries>
      </MEPSettingProvider>
    );

    // Did not re-query
    expect(eventsStatsMock).toHaveBeenCalledTimes(1);
    expect(childProps.timeseriesResults[0].seriesName).toEqual(
      'this query alias changed : count()'
    );
  });

  describe('multi-series grouped data', () => {
    const [START, END] = [1647399900, 1647399901];
    let mockCountData, mockCountUniqueData, mockRawResultData;

    beforeEach(() => {
      mockCountData = {
        start: START,
        end: END,
        data: [
          [START, [{'count()': 0}]],
          [END, [{'count()': 0}]],
        ],
      };
      mockCountUniqueData = {
        start: START,
        end: END,
        data: [
          [START, [{'count_unique()': 0}]],
          [END, [{'count_unique()': 0}]],
        ],
      };
      mockRawResultData = {
        local: {
          'count()': mockCountData,
          'count_unique()': mockCountUniqueData,
          order: 0,
        },
        prod: {
          'count()': mockCountData,
          'count_unique()': mockCountUniqueData,
          order: 1,
        },
      };
    });

    it('combines group name and aggregate names in grouped multi series data', () => {
      const actual = flattenMultiSeriesDataWithGrouping(mockRawResultData, '');
      expect(actual).toEqual([
        [
          0,
          expect.objectContaining({
            seriesName: 'local : count()',
            data: expect.anything(),
          }),
        ],
        [
          0,
          expect.objectContaining({
            seriesName: 'local : count_unique()',
            data: expect.anything(),
          }),
        ],
        [
          1,
          expect.objectContaining({
            seriesName: 'prod : count()',
            data: expect.anything(),
          }),
        ],
        [
          1,
          expect.objectContaining({
            seriesName: 'prod : count_unique()',
            data: expect.anything(),
          }),
        ],
      ]);
    });

    it('prefixes with a query alias when provided', () => {
      const actual = flattenMultiSeriesDataWithGrouping(mockRawResultData, 'Query 1');
      expect(actual).toEqual([
        [
          0,
          expect.objectContaining({
            seriesName: 'Query 1 > local : count()',
            data: expect.anything(),
          }),
        ],
        [
          0,
          expect.objectContaining({
            seriesName: 'Query 1 > local : count_unique()',
            data: expect.anything(),
          }),
        ],
        [
          1,
          expect.objectContaining({
            seriesName: 'Query 1 > prod : count()',
            data: expect.anything(),
          }),
        ],
        [
          1,
          expect.objectContaining({
            seriesName: 'Query 1 > prod : count_unique()',
            data: expect.anything(),
          }),
        ],
      ]);
    });
  });

  it('charts send metricsEnhanced requests', async function () {
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
      <DashboardsMEPContext.Provider
        value={{
          isMetricsData: undefined,
          setIsMetricsData: setIsMetricsMock,
        }}
      >
        <WidgetQueries
          api={api}
          widget={singleQueryWidget}
          organization={{
            ...organization,
            features: [...organization.features, 'dashboards-mep'],
          }}
          selection={selection}
        >
          {children}
        </WidgetQueries>
      </DashboardsMEPContext.Provider>
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

  it('tables send metricsEnhanced requests', async function () {
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
      <DashboardsMEPContext.Provider
        value={{
          isMetricsData: undefined,
          setIsMetricsData: setIsMetricsMock,
        }}
      >
        <WidgetQueries
          api={api}
          widget={{...singleQueryWidget, displayType: 'table'}}
          organization={{
            ...organization,
            features: [...organization.features, 'dashboards-mep'],
          }}
          selection={selection}
        >
          {children}
        </WidgetQueries>
      </DashboardsMEPContext.Provider>
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

  it('does not inject equation aliases for top N requests', async function () {
    const testData = initializeOrg({
      organization: {
        ...TestStubs.Organization(),
      },
    });
    const eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: [],
    });
    const areaWidget = {
      displayType: 'area',
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
      <WidgetQueries
        api={api}
        widget={areaWidget}
        organization={testData.organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </WidgetQueries>
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
