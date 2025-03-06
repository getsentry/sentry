import {
  MetricsFieldFixture,
  MetricsSessionUserCountByStatusByReleaseFixture,
} from 'sentry-fixture/metrics';
import {SessionsFieldFixture} from 'sentry-fixture/sessions';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {
  DashboardFilterKeys,
  DisplayType,
  WidgetType,
} from 'sentry/views/dashboards/types';
import ReleaseWidgetQueries from 'sentry/views/dashboards/widgetCard/releaseWidgetQueries';

describe('Dashboards > ReleaseWidgetQueries', function () {
  const {organization} = initializeOrg();

  const badMessage = 'Bad request data';

  const multipleQueryWidget = {
    title: 'Sessions vs. Users',
    interval: '5m',
    displayType: DisplayType.LINE,
    queries: [
      {
        conditions: '',
        fields: [`sum(session)`],
        aggregates: [`sum(session)`],
        columns: [],
        name: 'sessions',
        orderby: '',
      },
      {
        conditions: 'environment:prod',
        fields: [`sum(session)`],
        aggregates: [`sum(session)`],
        columns: [],
        name: 'users',
        orderby: '',
      },
    ],
    widgetType: WidgetType.RELEASE,
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
        orderby: '-count_unique(user)',
      },
    ],
    widgetType: WidgetType.RELEASE,
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

  const api = new MockApiClient();

  beforeEach(function () {
    setMockDate(new Date('2022-08-02'));
  });
  afterEach(function () {
    MockApiClient.clearMockResponses();
    resetMockDate();
  });

  it('can send chart requests', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: MetricsFieldFixture(`session.all`),
    });
    const children = jest.fn(() => <div />);

    render(
      <ReleaseWidgetQueries
        api={api}
        widget={singleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    expect(mock).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(children).toHaveBeenLastCalledWith(
        expect.objectContaining({
          tableResults: undefined,
          timeseriesResults: [
            {
              data: expect.arrayContaining([
                {name: '2021-12-01T16:15:00Z', value: 443.6200417187068},
                {name: '2021-12-01T16:30:00Z', value: 471.7512262596214},
                {name: '2021-12-01T16:45:00Z', value: 632.5356294251225},
                {name: '2021-12-01T17:00:00Z', value: 538.6063865509535},
              ]),
              seriesName: 'sessions > sum(session)',
            },
          ],
        })
      )
    );
  });

  it('fetches release data when sorting on release for metrics api', async function () {
    const mockRelease = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [
        {
          version: 'be1ddfb18126dd2cbde26bfe75488503280e716e',
        },
      ],
    });
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: MetricsSessionUserCountByStatusByReleaseFixture(),
    });
    const children = jest.fn(() => <div />);
    const queries = [
      {
        conditions: '',
        fields: [`count_unique(user)`],
        aggregates: [`count_unique(user)`],
        columns: ['release'],
        name: 'sessions',
        orderby: '-release',
      },
    ];

    render(
      <ReleaseWidgetQueries
        api={api}
        widget={{...singleQueryWidget, queries}}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    await waitFor(() => expect(mockRelease).toHaveBeenCalledTimes(1));
    expect(mockRelease).toHaveBeenCalledWith(
      '/organizations/org-slug/releases/',
      expect.objectContaining({
        data: {
          environment: ['prod'],
          per_page: 50,
          project: [1],
          sort: 'date',
        },
      })
    );
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/metrics/data/',
      expect.objectContaining({
        query: {
          environment: ['prod'],
          field: ['count_unique(sentry.sessions.user)'],
          groupBy: ['release'],
          includeSeries: 1,
          includeTotals: 1,
          interval: '1h',
          per_page: 100,
          project: [1],
          query: ' release:be1ddfb18126dd2cbde26bfe75488503280e716e',
          statsPeriod: '14d',
        },
      })
    );
  });

  it('calls session api when session.status is a group by', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sessions/',
      body: MetricsFieldFixture(`count_unique(user)`),
    });
    const children = jest.fn(() => <div />);
    const queries = [
      {
        conditions: '',
        fields: [`count_unique(user)`],
        aggregates: [`count_unique(user)`],
        columns: ['session.status'],
        name: 'sessions',
        orderby: '-count_unique(user)',
      },
    ];

    render(
      <ReleaseWidgetQueries
        api={api}
        widget={{...singleQueryWidget, queries}}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    await waitFor(() => {
      expect(mock).toHaveBeenCalledWith(
        '/organizations/org-slug/sessions/',
        expect.objectContaining({
          query: expect.objectContaining({
            environment: ['prod'],
            field: ['count_unique(user)'],
            groupBy: ['session.status'],
            interval: '30m',
            project: [1],
            statsPeriod: '14d',
          }),
        })
      );
    });
  });

  it('appends dashboard filters to releases request', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: MetricsSessionUserCountByStatusByReleaseFixture(),
    });

    render(
      <ReleaseWidgetQueries
        api={api}
        widget={singleQueryWidget}
        organization={organization}
        selection={selection}
        dashboardFilters={{[DashboardFilterKeys.RELEASE]: ['abc@1.3.0']}}
      >
        {() => <div data-test-id="child" />}
      </ReleaseWidgetQueries>
    );

    await screen.findByTestId('child');

    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/metrics/data/',
      expect.objectContaining({
        query: expect.objectContaining({
          query: ' release:"abc@1.3.0" ',
        }),
      })
    );
  });

  it('strips injected sort columns', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: MetricsSessionUserCountByStatusByReleaseFixture(),
    });
    const children = jest.fn(() => <div />);

    const injectedOrderby = {
      title: 'Sessions',
      interval: '5m',
      displayType: DisplayType.LINE,
      queries: [
        {
          conditions: '',
          fields: [`sum(session)`],
          aggregates: [`sum(session)`],
          columns: [],
          name: 'sessions',
          orderby: '-count_unique(user)',
        },
      ],
      widgetType: WidgetType.RELEASE,
    };

    render(
      <ReleaseWidgetQueries
        api={api}
        widget={injectedOrderby}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
    );
    expect(mock).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(children).toHaveBeenLastCalledWith(
        expect.objectContaining({
          errorMessage: undefined,
          loading: false,
          timeseriesResults: [
            {
              data: [
                {name: '2022-01-15T00:00:00Z', value: 0},
                {name: '2022-01-16T00:00:00Z', value: 0},
                {name: '2022-01-17T00:00:00Z', value: 0},
                {name: '2022-01-18T00:00:00Z', value: 0},
                {name: '2022-01-19T00:00:00Z', value: 0},
                {name: '2022-01-20T00:00:00Z', value: 0},
                {name: '2022-01-21T00:00:00Z', value: 0},
                {name: '2022-01-22T00:00:00Z', value: 0},
                {name: '2022-01-23T00:00:00Z', value: 0},
                {name: '2022-01-24T00:00:00Z', value: 23},
                {name: '2022-01-25T00:00:00Z', value: 11},
                {name: '2022-01-26T00:00:00Z', value: 0},
                {name: '2022-01-27T00:00:00Z', value: 0},
                {name: '2022-01-28T00:00:00Z', value: 0},
              ],
              seriesName: 'sessions > crashed, 1 : sum(session)',
            },
            {
              data: [
                {name: '2022-01-15T00:00:00Z', value: 1},
                {name: '2022-01-16T00:00:00Z', value: 0},
                {name: '2022-01-17T00:00:00Z', value: 0},
                {name: '2022-01-18T00:00:00Z', value: 0},
                {name: '2022-01-19T00:00:00Z', value: 0},
                {name: '2022-01-20T00:00:00Z', value: 0},
                {name: '2022-01-21T00:00:00Z', value: 0},
                {name: '2022-01-22T00:00:00Z', value: 0},
                {name: '2022-01-23T00:00:00Z', value: 0},
                {name: '2022-01-24T00:00:00Z', value: 0},
                {name: '2022-01-25T00:00:00Z', value: 0},
                {name: '2022-01-26T00:00:00Z', value: 0},
                {name: '2022-01-27T00:00:00Z', value: 0},
                {name: '2022-01-28T00:00:00Z', value: 0},
              ],
              seriesName: 'sessions > abnormal, 1 : sum(session)',
            },
            {
              data: [
                {name: '2022-01-15T00:00:00Z', value: 0},
                {name: '2022-01-16T00:00:00Z', value: 0},
                {name: '2022-01-17T00:00:00Z', value: 0},
                {name: '2022-01-18T00:00:00Z', value: 0},
                {name: '2022-01-19T00:00:00Z', value: 0},
                {name: '2022-01-20T00:00:00Z', value: 37},
                {name: '2022-01-21T00:00:00Z', value: 0},
                {name: '2022-01-22T00:00:00Z', value: 0},
                {name: '2022-01-23T00:00:00Z', value: 0},
                {name: '2022-01-24T00:00:00Z', value: 335},
                {name: '2022-01-25T00:00:00Z', value: 79},
                {name: '2022-01-26T00:00:00Z', value: 0},
                {name: '2022-01-27T00:00:00Z', value: 0},
                {name: '2022-01-28T00:00:00Z', value: 0},
              ],
              seriesName: 'sessions > errored, 1 : sum(session)',
            },
            {
              data: [
                {name: '2022-01-15T00:00:00Z', value: 0},
                {name: '2022-01-16T00:00:00Z', value: 0},
                {name: '2022-01-17T00:00:00Z', value: 0},
                {name: '2022-01-18T00:00:00Z', value: 0},
                {name: '2022-01-19T00:00:00Z', value: 0},
                {name: '2022-01-20T00:00:00Z', value: 2503},
                {name: '2022-01-21T00:00:00Z', value: 661},
                {name: '2022-01-22T00:00:00Z', value: 0},
                {name: '2022-01-23T00:00:00Z', value: 0},
                {name: '2022-01-24T00:00:00Z', value: 1464},
                {name: '2022-01-25T00:00:00Z', value: 430},
                {name: '2022-01-26T00:00:00Z', value: 0},
                {name: '2022-01-27T00:00:00Z', value: 0},
                {name: '2022-01-28T00:00:00Z', value: 0},
              ],
              seriesName: 'sessions > healthy, 1 : sum(session)',
            },
            {
              data: [
                {name: '2022-01-15T00:00:00Z', value: 1},
                {name: '2022-01-16T00:00:00Z', value: 0},
                {name: '2022-01-17T00:00:00Z', value: 0},
                {name: '2022-01-18T00:00:00Z', value: 0},
                {name: '2022-01-19T00:00:00Z', value: 0},
                {name: '2022-01-20T00:00:00Z', value: 0},
                {name: '2022-01-21T00:00:00Z', value: 0},
                {name: '2022-01-22T00:00:00Z', value: 0},
                {name: '2022-01-23T00:00:00Z', value: 0},
                {name: '2022-01-24T00:00:00Z', value: 23},
                {name: '2022-01-25T00:00:00Z', value: 11},
                {name: '2022-01-26T00:00:00Z', value: 0},
                {name: '2022-01-27T00:00:00Z', value: 0},
                {name: '2022-01-28T00:00:00Z', value: 0},
              ],
              seriesName: 'sessions > crashed, 2 : sum(session)',
            },
            {
              data: [
                {name: '2022-01-15T00:00:00Z', value: 1},
                {name: '2022-01-16T00:00:00Z', value: 0},
                {name: '2022-01-17T00:00:00Z', value: 0},
                {name: '2022-01-18T00:00:00Z', value: 0},
                {name: '2022-01-19T00:00:00Z', value: 0},
                {name: '2022-01-20T00:00:00Z', value: 0},
                {name: '2022-01-21T00:00:00Z', value: 0},
                {name: '2022-01-22T00:00:00Z', value: 0},
                {name: '2022-01-23T00:00:00Z', value: 0},
                {name: '2022-01-24T00:00:00Z', value: 0},
                {name: '2022-01-25T00:00:00Z', value: 0},
                {name: '2022-01-26T00:00:00Z', value: 0},
                {name: '2022-01-27T00:00:00Z', value: 0},
                {name: '2022-01-28T00:00:00Z', value: 0},
              ],
              seriesName: 'sessions > abnormal, 2 : sum(session)',
            },
            {
              data: [
                {name: '2022-01-15T00:00:00Z', value: 1},
                {name: '2022-01-16T00:00:00Z', value: 0},
                {name: '2022-01-17T00:00:00Z', value: 0},
                {name: '2022-01-18T00:00:00Z', value: 0},
                {name: '2022-01-19T00:00:00Z', value: 0},
                {name: '2022-01-20T00:00:00Z', value: 37},
                {name: '2022-01-21T00:00:00Z', value: 0},
                {name: '2022-01-22T00:00:00Z', value: 0},
                {name: '2022-01-23T00:00:00Z', value: 0},
                {name: '2022-01-24T00:00:00Z', value: 335},
                {name: '2022-01-25T00:00:00Z', value: 79},
                {name: '2022-01-26T00:00:00Z', value: 0},
                {name: '2022-01-27T00:00:00Z', value: 0},
                {name: '2022-01-28T00:00:00Z', value: 0},
              ],
              seriesName: 'sessions > errored, 2 : sum(session)',
            },
            {
              data: [
                {name: '2022-01-15T00:00:00Z', value: 1},
                {name: '2022-01-16T00:00:00Z', value: 0},
                {name: '2022-01-17T00:00:00Z', value: 0},
                {name: '2022-01-18T00:00:00Z', value: 0},
                {name: '2022-01-19T00:00:00Z', value: 0},
                {name: '2022-01-20T00:00:00Z', value: 2503},
                {name: '2022-01-21T00:00:00Z', value: 661},
                {name: '2022-01-22T00:00:00Z', value: 0},
                {name: '2022-01-23T00:00:00Z', value: 0},
                {name: '2022-01-24T00:00:00Z', value: 1464},
                {name: '2022-01-25T00:00:00Z', value: 430},
                {name: '2022-01-26T00:00:00Z', value: 0},
                {name: '2022-01-27T00:00:00Z', value: 0},
                {name: '2022-01-28T00:00:00Z', value: 0},
              ],
              seriesName: 'sessions > healthy, 2 : sum(session)',
            },
          ],
        })
      )
    );
  });

  it('can send table requests', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: MetricsSessionUserCountByStatusByReleaseFixture(),
    });
    const children = jest.fn(() => <div />);

    render(
      <ReleaseWidgetQueries
        api={api}
        widget={{...singleQueryWidget, displayType: DisplayType.TABLE}}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
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
                  'count_unique(user)': 1,
                  id: '0',
                  release: '1',
                  'session.status': 'crashed',
                  'sum(session)': 34,
                },
                {
                  'count_unique(user)': 1,
                  id: '1',
                  release: '1',
                  'session.status': 'abnormal',
                  'sum(session)': 1,
                },
                {
                  'count_unique(user)': 2,
                  id: '2',
                  release: '1',
                  'session.status': 'errored',
                  'sum(session)': 451,
                },
                {
                  'count_unique(user)': 3,
                  id: '3',
                  release: '1',
                  'session.status': 'healthy',
                  'sum(session)': 5058,
                },
                {
                  'count_unique(user)': 2,
                  id: '4',
                  release: '2',
                  'session.status': 'crashed',
                  'sum(session)': 35,
                },
                {
                  'count_unique(user)': 1,
                  id: '5',
                  release: '2',
                  'session.status': 'abnormal',
                  'sum(session)': 1,
                },
                {
                  'count_unique(user)': 1,
                  id: '6',
                  release: '2',
                  'session.status': 'errored',
                  'sum(session)': 452,
                },
                {
                  'count_unique(user)': 10,
                  id: '7',
                  release: '2',
                  'session.status': 'healthy',
                  'sum(session)': 5059,
                },
              ],
              meta: {
                'count_unique(user)': 'integer',
                release: 'string',
                'session.status': 'string',
                'sum(session)': 'integer',
                fields: {
                  'count_unique(user)': 'integer',
                  release: 'string',
                  'session.status': 'string',
                  'sum(session)': 'integer',
                },
              },
              title: 'sessions',
            },
          ],
          timeseriesResults: undefined,
        })
      )
    );
  });

  it('can send big number requests', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: MetricsFieldFixture(`count_unique(sentry.sessions.user)`),
    });
    const children = jest.fn(() => <div />);

    render(
      <ReleaseWidgetQueries
        api={api}
        widget={{...singleQueryWidget, displayType: DisplayType.BIG_NUMBER}}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          field: ['count_unique(sentry.sessions.user)'],
          orderBy: '-count_unique(sentry.sessions.user)',
        }),
      })
    );

    await waitFor(() =>
      expect(children).toHaveBeenLastCalledWith(
        expect.objectContaining({
          loading: false,
          tableResults: [
            {
              data: [{'count_unique(user)': 51292.95404741901, id: '0'}],
              meta: {
                'count_unique(user)': 'integer',
                fields: {'count_unique(user)': 'integer'},
              },
              title: 'sessions',
            },
          ],
        })
      )
    );
  });

  it('can send multiple API requests', async function () {
    const metricsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`session.all`),
      match: [
        MockApiClient.matchQuery({
          field: [`session.all`],
        }),
      ],
    });
    render(
      <ReleaseWidgetQueries
        api={api}
        widget={multipleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </ReleaseWidgetQueries>
    );
    // Child should be rendered and 2 requests should be sent.
    expect(await screen.findByTestId('child')).toBeInTheDocument();
    expect(metricsMock).toHaveBeenCalledTimes(2);
    expect(metricsMock).toHaveBeenNthCalledWith(
      1,
      '/organizations/org-slug/metrics/data/',
      expect.objectContaining({
        query: {
          environment: ['prod'],
          field: ['session.all'],
          groupBy: [],
          interval: '30m',
          project: [1],
          statsPeriod: '14d',
          per_page: 1,
          includeSeries: 1,
          includeTotals: 0,
        },
      })
    );
    expect(metricsMock).toHaveBeenNthCalledWith(
      2,
      '/organizations/org-slug/metrics/data/',
      expect.objectContaining({
        query: {
          environment: ['prod'],
          field: ['session.all'],
          groupBy: [],
          interval: '30m',
          project: [1],
          query: 'environment:prod',
          statsPeriod: '14d',
          per_page: 1,
          includeSeries: 1,
          includeTotals: 0,
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
          field: [`session.all`],
        }),
      ],
    });
    const children = jest.fn(() => <div data-test-id="child" />);

    render(
      <ReleaseWidgetQueries
        api={api}
        widget={multipleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
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

  it('adjusts interval based on date window', async function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`session.all`),
    });

    render(
      <ReleaseWidgetQueries
        api={api}
        widget={{...singleQueryWidget, interval: '1m'}}
        organization={organization}
        selection={{...selection, datetime: {...selection.datetime, period: '14d'}}}
      >
        {() => <div data-test-id="child" />}
      </ReleaseWidgetQueries>
    );

    expect(await screen.findByTestId('child')).toBeInTheDocument();
    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          interval: '30m',
          statsPeriod: '14d',
          environment: ['prod'],
          project: [1],
        }),
      })
    );
  });

  it('does not re-fetch when renaming legend alias / adding falsy fields', async () => {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`session.all`),
    });
    const children = jest.fn(() => <div />);

    const {rerender} = render(
      <ReleaseWidgetQueries
        api={api}
        widget={singleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    await waitFor(() => {
      expect(mock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ReleaseWidgetQueries
        api={api}
        widget={{
          ...singleQueryWidget,
          queries: [
            {
              ...singleQueryWidget.queries[0]!,
              name: 'New Legend Alias',
              fields: [...singleQueryWidget.queries[0]!.fields, ''],
            },
          ],
        }}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    // no additional request has been sent, the total count of requests is still 1
    await waitFor(() => {
      expect(mock).toHaveBeenCalledTimes(1);
    });
  });

  it('does not re-fetch when dashboard filter remains the same', async () => {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`session.all`),
    });
    const children = jest.fn(() => <div />);

    const {rerender} = render(
      <ReleaseWidgetQueries
        api={api}
        widget={singleQueryWidget}
        organization={organization}
        selection={selection}
        dashboardFilters={{[DashboardFilterKeys.RELEASE]: ['abc@1.3.0']}}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    await waitFor(() => {
      expect(mock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <ReleaseWidgetQueries
        api={api}
        widget={singleQueryWidget}
        organization={organization}
        selection={selection}
        dashboardFilters={{[DashboardFilterKeys.RELEASE]: ['abc@1.3.0']}}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    // no additional request has been sent, the total count of requests is still 1
    await waitFor(() => {
      expect(mock).toHaveBeenCalledTimes(1);
    });
  });

  it('fetches releases if required', async () => {
    const dataMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: SessionsFieldFixture(`session.all`),
    });

    const releasesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [
        {id: 1, version: '0.0.1'},
        {id: 2, version: '0.0.2'},
      ],
    });

    const releasesWidget = {
      title: 'Crash Rate',
      interval: '5m',
      displayType: DisplayType.TABLE,
      queries: [
        {
          name: '',
          conditions: '',
          fields: [`count_unique(user)`],
          aggregates: [`count_unique(user)`],
          columns: ['release'],
          orderby: '-count_unique(user)',
        },
      ],
      widgetType: WidgetType.RELEASE,
    };

    const children = jest.fn(() => <div />);

    const {rerender} = render(
      <ReleaseWidgetQueries
        api={api}
        widget={releasesWidget}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    await waitFor(() => {
      expect(dataMock).toHaveBeenCalledTimes(1);
    });

    expect(releasesMock).not.toHaveBeenCalled();

    rerender(
      <ReleaseWidgetQueries
        api={api}
        widget={{
          ...releasesWidget,
          queries: [
            {
              ...releasesWidget.queries[0]!,
              orderby: '-release',
            },
          ],
        }}
        organization={organization}
        selection={selection}
      >
        {children}
      </ReleaseWidgetQueries>
    );

    await waitFor(() => {
      expect(dataMock).toHaveBeenCalledTimes(2);
    });

    expect(releasesMock).toHaveBeenCalledTimes(1);
  });
});
