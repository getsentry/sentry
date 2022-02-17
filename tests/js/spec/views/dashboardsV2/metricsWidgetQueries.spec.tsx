import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {Client} from 'sentry/api';
import {SessionMetric} from 'sentry/utils/metrics/fields';
import {DisplayType, WidgetType} from 'sentry/views/dashboardsV2/types';
import MetricsWidgetQueries from 'sentry/views/dashboardsV2/widgetCard/metricsWidgetQueries';

describe('Dashboards > MetricsWidgetQueries', function () {
  const {organization, routerContext} = initializeOrg();

  const badMessage = 'Bad request data';

  const multipleQueryWidget = {
    title: 'Sessions vs. Users',
    interval: '5m',
    displayType: DisplayType.LINE,
    queries: [
      {
        conditions: '',
        fields: [SessionMetric.SENTRY_SESSIONS_SESSION],
        name: 'sessions',
        orderby: '',
      },
      {
        conditions: '',
        fields: [SessionMetric.SENTRY_SESSIONS_USER],
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
        fields: [SessionMetric.SENTRY_SESSIONS_SESSION],
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

  it('can send multiple API requests', function () {
    const userMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({field: SessionMetric.SENTRY_SESSIONS_USER}),
      match: [MockApiClient.matchQuery({field: [SessionMetric.SENTRY_SESSIONS_USER]})],
    });
    const sessionMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({field: SessionMetric.SENTRY_SESSIONS_SESSION}),
      match: [MockApiClient.matchQuery({field: [SessionMetric.SENTRY_SESSIONS_SESSION]})],
    });
    mountWithTheme(
      <MetricsWidgetQueries
        api={api}
        widget={multipleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {() => <div data-test-id="child" />}
      </MetricsWidgetQueries>,
      {
        context: routerContext,
      }
    );

    // Child should be rendered and 2 requests should be sent.
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(userMock).toHaveBeenCalledTimes(1);
    expect(sessionMock).toHaveBeenCalledTimes(1);
  });

  it('sets errorMessage when the first request fails', async function () {
    const okMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({field: SessionMetric.SENTRY_SESSIONS_USER}),
      match: [MockApiClient.matchQuery({field: [SessionMetric.SENTRY_SESSIONS_USER]})],
    });
    const failMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      statusCode: 400,
      body: {detail: badMessage},
      match: [MockApiClient.matchQuery({field: [SessionMetric.SENTRY_SESSIONS_SESSION]})],
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
      </MetricsWidgetQueries>,
      {context: routerContext}
    );

    // Child should be rendered and 2 requests should be sent.
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(okMock).toHaveBeenCalledTimes(1);
    expect(failMock).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(children).toHaveBeenLastCalledWith(
        expect.objectContaining({errorMessage: badMessage})
      )
    );
  });

  it('adjusts interval based on date window', function () {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({field: SessionMetric.SENTRY_SESSIONS_SESSION}),
    });

    mountWithTheme(
      <MetricsWidgetQueries
        api={api}
        widget={{...singleQueryWidget, interval: '1m'}}
        organization={organization}
        selection={{...selection, datetime: {...selection.datetime, period: '90d'}}}
      >
        {() => <div data-test-id="child" />}
      </MetricsWidgetQueries>,
      {context: routerContext}
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

  it('does not re-fetch when renaming legend alias', () => {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/metrics/data/',
      body: TestStubs.MetricsField({field: SessionMetric.SENTRY_SESSIONS_SESSION}),
    });
    const children = jest.fn(() => <div data-test-id="child" />);

    const {rerender} = mountWithTheme(
      <MetricsWidgetQueries
        api={api}
        widget={singleQueryWidget}
        organization={organization}
        selection={selection}
      >
        {children}
      </MetricsWidgetQueries>,
      {context: routerContext}
    );

    expect(mock).toHaveBeenCalledTimes(1);

    rerender(
      <MetricsWidgetQueries
        api={api}
        widget={{
          ...singleQueryWidget,
          queries: [{...singleQueryWidget.queries[0], name: 'New Legend Alias'}],
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
