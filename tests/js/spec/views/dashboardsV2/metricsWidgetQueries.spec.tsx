import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {SessionMetric} from 'sentry/utils/metrics/fields';
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
        fields: [`sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`],
        name: 'sessions',
        orderby: '',
      },
      {
        conditions: 'environment:prod',
        fields: [`sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`],
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
        fields: [`count_unique(${SessionMetric.SENTRY_SESSIONS_USER})`],
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
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({
        field: `sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`,
      }),
    });
    const children = jest.fn(() => <div />);

    mountWithTheme(
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
          errorMessage: undefined,
          loading: false,
          tableResults: [],
          timeseriesResults: [
            {
              data: expect.arrayContaining([
                {name: '2021-12-01T16:15:00Z', value: 443.6200417187068},
                {name: '2021-12-01T16:30:00Z', value: 471.7512262596214},
                {name: '2021-12-02T15:45:00Z', value: 485.26355742991586},
                {name: '2021-12-02T16:00:00Z', value: 460.14344601636975},
              ]),
              seriesName: 'sessions: sum(sentry.sessions.session)',
            },
          ],
        })
      )
    );
  });

  it('can send table requests', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsSessionUserCountByStatusByRelease(),
    });
    const children = jest.fn(() => <div />);

    mountWithTheme(
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
                  'count_unique(sentry.sessions.user)': 1,
                  id: '0',
                  release: '1',
                  'session.status': 'crashed',
                  'sum(sentry.sessions.session)': 34,
                },
                {
                  'count_unique(sentry.sessions.user)': 1,
                  id: '1',
                  release: '1',
                  'session.status': 'abnormal',
                  'sum(sentry.sessions.session)': 1,
                },
                {
                  'count_unique(sentry.sessions.user)': 2,
                  id: '2',
                  release: '1',
                  'session.status': 'errored',
                  'sum(sentry.sessions.session)': 451,
                },
                {
                  'count_unique(sentry.sessions.user)': 3,
                  id: '3',
                  release: '1',
                  'session.status': 'healthy',
                  'sum(sentry.sessions.session)': 5058,
                },
                {
                  'count_unique(sentry.sessions.user)': 2,
                  id: '4',
                  release: '2',
                  'session.status': 'crashed',
                  'sum(sentry.sessions.session)': 35,
                },
                {
                  'count_unique(sentry.sessions.user)': 1,
                  id: '5',
                  release: '2',
                  'session.status': 'abnormal',
                  'sum(sentry.sessions.session)': 1,
                },
                {
                  'count_unique(sentry.sessions.user)': 1,
                  id: '6',
                  release: '2',
                  'session.status': 'errored',
                  'sum(sentry.sessions.session)': 452,
                },
                {
                  'count_unique(sentry.sessions.user)': 10,
                  id: '7',
                  release: '2',
                  'session.status': 'healthy',
                  'sum(sentry.sessions.session)': 5059,
                },
              ],
              meta: {
                'count_unique(sentry.sessions.user)': 'integer',
                release: 'string',
                'session.status': 'string',
                'sum(sentry.sessions.session)': 'integer',
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
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({
        field: `count_unique(${SessionMetric.SENTRY_SESSIONS_USER})`,
      }),
    });
    const children = jest.fn(() => <div />);

    mountWithTheme(
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
          per_page: 1,
          orderBy: `count_unique(${SessionMetric.SENTRY_SESSIONS_USER})`,
        }),
      })
    );

    await waitFor(() =>
      expect(children).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
          tableResults: [
            {
              data: [{id: '0', 'count_unique(sentry.sessions.user)': 51292.95404741901}],
              meta: {'count_unique(sentry.sessions.user)': 'integer'},
              title: 'sessions',
            },
          ],
        })
      )
    );
  });

  it('can send multiple API requests', function () {
    const sessionMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({
        field: `sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`,
      }),
      match: [
        MockApiClient.matchQuery({
          field: [`sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`],
        }),
      ],
    });
    mountWithTheme(
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
      '/organizations/org-slug/metrics/data/',
      expect.objectContaining({
        query: {
          environment: ['prod'],
          field: ['sum(sentry.sessions.session)'],
          interval: '30m',
          project: [1],
          statsPeriod: '14d',
        },
      })
    );
    expect(sessionMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/metrics/data/',
      expect.objectContaining({
        query: {
          environment: ['prod'],
          field: ['sum(sentry.sessions.session)'],
          interval: '30m',
          project: [1],
          statsPeriod: '14d',
          query: 'environment:prod',
        },
      })
    );
  });

  it('sets errorMessage when the first request fails', async function () {
    const failMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      statusCode: 400,
      body: {detail: badMessage},
      match: [
        MockApiClient.matchQuery({
          field: [`sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`],
        }),
      ],
    });
    const children = jest.fn(() => <div data-test-id="child" />);

    mountWithTheme(
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
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({
        field: `sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`,
      }),
    });

    mountWithTheme(
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
          interval: '4h',
          statsPeriod: '90d',
          environment: ['prod'],
          project: [1],
        }),
      })
    );
  });

  it('does not re-fetch when renaming legend alias / adding falsy fields', () => {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({
        field: `sum(${SessionMetric.SENTRY_SESSIONS_SESSION})`,
      }),
    });
    const children = jest.fn(() => <div />);

    const {rerender} = mountWithTheme(
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
