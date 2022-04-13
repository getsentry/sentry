import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import MetricsWidgetQueries from 'sentry/views/dashboardsV2/widgetCard/metricsWidgetQueries';

describe('Dashboards > MetricsWidgetQueries', function () {
  const {organization} = initializeOrg();

  const badMessage = 'Bad request data';

  const multipleQueryWidget = {
    title: 'Sessions vs. Users',
    interval: '5m',
    displayType: DisplayType.LINE,
    queries: [
      {
        conditions: '',
        fields: [`sum(sessions)`],
        aggregates: [`sum(sessions)`],
        columns: [],
        name: 'sessions',
        orderby: '',
      },
      {
        conditions: 'environment:prod',
        fields: [`sum(sessions)`],
        aggregates: [`sum(sessions)`],
        columns: [],
        name: 'users',
        orderby: '',
      },
    ],
    widgetType: WidgetType.METRICS,
  };
  const singleQueryWidget = {
    title: 'Sessions',
    interval: '5m',
    displayType: DisplayType.LINE,
    queries: [
      {
        conditions: '',
        fields: [`count_unique(user)`],
        aggregates: [`count_unique(user)`],
        columns: [],
        name: 'sessions',
        orderby: '',
      },
    ],
    widgetType: WidgetType.METRICS,
  };
  const selection = {
    projects: [1],
    environments: ['prod'],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: null,
    },
  };

  const api = new Client();

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('can send chart requests', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: TestStubs.SessionsField({
        field: `sum(sessions)`,
      }),
    });
    const children = jest.fn(() => <div />);

    render(
      <MetricsWidgetQueries
        api={api}
        widget={singleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {children}
      </MetricsWidgetQueries>
    );

    expect(mock).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(children).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tableResults: [],
          timeseriesResults: [
            {
              data: expect.arrayContaining([
                {name: '2021-03-15T00:00:00Z', value: 0},
                {name: '2021-03-16T00:00:00Z', value: 0},
                {name: '2021-03-17T00:00:00Z', value: 2},
                {name: '2021-03-18T00:00:00Z', value: 490},
              ]),
              seriesName: 'sessions: sum(sessions)',
            },
          ],
        })
      )
    );
  });

  it('can send table requests', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: TestStubs.SessionUserStatusCountByReleaseInPeriod(),
    });
    const children = jest.fn(() => <div />);

    render(
      <MetricsWidgetQueries
        api={api}
        widget={{...singleQueryWidget, displayType: DisplayType.TABLE}}
        organization={organization}
        selection={selection}
      >
        {children}
      </MetricsWidgetQueries>
    );
    expect(mock).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(children).toHaveBeenLastCalledWith(
        expect.objectContaining({
          errorMessage: undefined,
          loading: false,
          tableResults: [
            {
              data: [
                {
                  'count_unique(user)': 92,
                  id: '0',
                  project: 123,
                  release: '7a82c130be9143361f20bc77252df783cf91e4fc',
                  'session.status': 'crashed',
                  'sum(session)': 492,
                },
                {
                  'count_unique(user)': 760,
                  id: '1',
                  project: 123,
                  release: 'e102abb2c46e7fe8686441091005c12aed90da99',
                  'session.status': 'healthy',
                  'sum(session)': 6260,
                },
                {
                  'count_unique(user)': 0,
                  id: '2',
                  project: 123,
                  release: 'e102abb2c46e7fe8686441091005c12aed90da99',
                  'session.status': 'abnormal',
                  'sum(session)': 0,
                },
                {
                  'count_unique(user)': 1,
                  id: '3',
                  project: 123,
                  release: 'e102abb2c46e7fe8686441091005c12aed90da99',
                  'session.status': 'crashed',
                  'sum(session)': 5,
                },
                {
                  'count_unique(user)': 0,
                  id: '4',
                  project: 123,
                  release: '7a82c130be9143361f20bc77252df783cf91e4fc',
                  'session.status': 'abnormal',
                  'sum(session)': 0,
                },
                {
                  'count_unique(user)': 9,
                  id: '5',
                  project: 123,
                  release: 'e102abb2c46e7fe8686441091005c12aed90da99',
                  'session.status': 'errored',
                  'sum(session)': 59,
                },
                {
                  'count_unique(user)': 99136,
                  id: '6',
                  project: 123,
                  release: '7a82c130be9143361f20bc77252df783cf91e4fc',
                  'session.status': 'healthy',
                  'sum(session)': 202136,
                },
                {
                  'count_unique(user)': 915,
                  id: '7',
                  project: 123,
                  release: '7a82c130be9143361f20bc77252df783cf91e4fc',
                  'session.status': 'errored',
                  'sum(session)': 1954,
                },
              ],
              meta: {
                'count_unique(user)': 'integer',
                project: 'string',
                release: 'string',
                'session.status': 'string',
                'sum(session)': 'integer',
              },
              title: 'sessions',
            },
          ],
          timeseriesResults: [],
        })
      )
    );
  });

  it('can send big number requests', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: TestStubs.SessionsField({
        field: `count_unique(user)`,
      }),
    });
    const children = jest.fn(() => <div />);

    render(
      <MetricsWidgetQueries
        api={api}
        widget={{...singleQueryWidget, displayType: DisplayType.BIG_NUMBER}}
        organization={organization}
        selection={selection}
      >
        {children}
      </MetricsWidgetQueries>
    );

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['count_unique(user)'],
        }),
      })
    );

    await waitFor(() =>
      expect(children).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
          tableResults: [
            {
              data: [{id: '0', 'count_unique(user)': 492}],
              meta: {'count_unique(user)': 'integer'},
              title: 'sessions',
            },
          ],
        })
      )
    );
  });

  it('can send multiple API requests', function () {
    const sessionMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: TestStubs.SessionsField({
        field: `sum(sessions)`,
      }),
      match: [
        MockApiClient.matchQuery({
          field: [`sum(sessions)`],
        }),
      ],
    });
    render(
      <MetricsWidgetQueries
        api={api}
        widget={multipleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </MetricsWidgetQueries>
    );
    // Child should be rendered and 2 requests should be sent.
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(sessionMock).toHaveBeenCalledTimes(2);
    expect(sessionMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/sessions/',
      expect.objectContaining({
        query: {
          environment: ['prod'],
          field: ['sum(sessions)'],
          groupBy: [],
          interval: '1h',
          project: [1],
          statsPeriod: '14d',
        },
      })
    );
    expect(sessionMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/sessions/',
      expect.objectContaining({
        query: {
          environment: ['prod'],
          field: ['sum(sessions)'],
          groupBy: [],
          interval: '1h',
          project: [1],
          query: 'environment:prod',
          statsPeriod: '14d',
        },
      })
    );
  });

  it('sets errorMessage when the first request fails', async function () {
    const failMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      statusCode: 400,
      body: {detail: badMessage},
      match: [
        MockApiClient.matchQuery({
          field: [`sum(sessions)`],
        }),
      ],
    });
    const children = jest.fn(() => <div data-test-id="child" />);

    render(
      <MetricsWidgetQueries
        api={api}
        widget={multipleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {children}
      </MetricsWidgetQueries>
    );

    // Child should be rendered and 2 requests should be sent.
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(failMock).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(children).toHaveBeenLastCalledWith(
        expect.objectContaining({errorMessage: badMessage})
      )
    );
  });

  it('adjusts interval based on date window', function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: TestStubs.SessionsField({
        field: `sum(sessions)`,
      }),
    });

    render(
      <MetricsWidgetQueries
        api={api}
        widget={{...singleQueryWidget, interval: '1m'}}
        organization={organization}
        selection={{...selection, datetime: {...selection.datetime, period: '90d'}}}
      >
        {() => <div data-test-id="child" />}
      </MetricsWidgetQueries>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          interval: '1d',
          statsPeriod: '90d',
          environment: ['prod'],
          project: [1],
        }),
      })
    );
  });

  it('does not re-fetch when renaming legend alias / adding falsy fields', () => {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: TestStubs.SessionsField({
        field: `sum(sessions)`,
      }),
    });
    const children = jest.fn(() => <div />);

    const {rerender} = render(
      <MetricsWidgetQueries
        api={api}
        widget={singleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {children}
      </MetricsWidgetQueries>
    );

    expect(mock).toHaveBeenCalledTimes(1);

    rerender(
      <MetricsWidgetQueries
        api={api}
        widget={{
          ...singleQueryWidget,
          queries: [
            {
              ...singleQueryWidget.queries[0],
              name: 'New Legend Alias',
              fields: [...singleQueryWidget.queries[0].fields, ''],
            },
          ],
        }}
        organization={organization}
        selection={selection}
      >
        {children}
      </MetricsWidgetQueries>
    );

    // no additional request has been sent, the total count of requests is still 1
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
