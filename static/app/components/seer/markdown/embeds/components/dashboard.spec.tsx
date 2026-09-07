import {DashboardFixture} from 'sentry-fixture/dashboard';
import {EventsStatsFixture} from 'sentry-fixture/events';
import {WidgetFixture} from 'sentry-fixture/widget';
import {WidgetQueryFixture} from 'sentry-fixture/widgetQuery';

import {screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';

import {renderEmbed} from './resourceEmbedTestUtils';

describe('dashboard embed', () => {
  let initialConfig: Config;

  beforeEach(() => {
    initialConfig = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(initialConfig);
  });

  it('links a dashboard title to the dashboard in the current organization', async () => {
    const {router} = renderEmbed({
      name: 'dashboard',
      level: 'inline',
      data: {
        id: '123',
        title: 'Application health',
      },
    });

    await userEvent.click(screen.getByRole('link', {name: 'Application health'}));

    expect(router.location.pathname).toBe('/organizations/org-slug/dashboard/123/');
  });

  it('uses a dashboard fallback label and normalizes customer-domain links', () => {
    ConfigStore.set('customerDomain', {
      subdomain: 'org-slug',
      organizationUrl: 'https://org-slug.sentry.io',
      sentryUrl: 'https://sentry.io',
    });

    renderEmbed({name: 'dashboard', data: {id: '456'}, level: 'inline'});

    expect(screen.getByRole('link', {name: 'Dashboard 456'})).toHaveAttribute(
      'href',
      '/dashboard/456/'
    );
  });

  it('renders a live preview of the first four dashboard widgets', async () => {
    const widgets = ['Errors', 'Latency', 'Users', 'Throughput', 'Slow spans'].map(
      (title, index) =>
        WidgetFixture({
          id: String(index + 1),
          title,
          displayType: index === 0 ? DisplayType.LINE : DisplayType.TEXT,
          widgetType: index === 0 ? WidgetType.ERRORS : undefined,
          description: `${title} details`,
          limit: index === 0 ? 20 : undefined,
        })
    );
    const dashboardRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/123/',
      body: DashboardFixture(widgets, {
        environment: ['production'],
        id: '123',
        projects: [1],
        title: 'Application health',
        utc: true,
      }),
    });
    const widgetDataRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: EventsStatsFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });

    const {unmount} = renderEmbed({
      name: 'dashboard',
      data: {id: '123'},
    });

    expect(
      await screen.findByRole('link', {name: 'Application health'}, {timeout: 5_000})
    ).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Throughput')).toBeInTheDocument();
    expect(screen.queryByText('Slow spans')).not.toBeInTheDocument();
    expect(screen.getByText('5 widgets')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'View 1 more widget'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/dashboard/123/'
    );
    expect(dashboardRequest).toHaveBeenCalled();
    await waitFor(() =>
      expect(widgetDataRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/events-stats/',
        expect.objectContaining({
          query: expect.objectContaining({
            environment: ['production'],
            interval: '10m',
            project: [1],
            statsPeriod: '24h',
            topEvents: 5,
          }),
        })
      )
    );
    unmount();
  });

  it('keeps dashboard legend interactions local to the embed', async () => {
    const widget = WidgetFixture({
      id: '1',
      title: 'Errors',
      displayType: DisplayType.LINE,
      widgetType: WidgetType.ERRORS,
      queries: [
        WidgetQueryFixture({
          name: 'Current',
          conditions: 'release:current',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
        }),
        WidgetQueryFixture({
          name: 'Previous',
          conditions: 'release:previous',
          fields: ['count()'],
          aggregates: ['count()'],
          columns: [],
        }),
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/123/',
      body: DashboardFixture([widget], {id: '123', title: 'Application health'}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: EventsStatsFixture(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
    });

    const {router, unmount} = renderEmbed({name: 'dashboard', data: {id: '123'}});
    await userEvent.click(await screen.findByRole('button', {name: '+2 more'}));
    const option = await screen.findByRole('option', {name: /Current : count\(\)/});

    expect(option).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(option);

    expect(option).toHaveAttribute('aria-selected', 'false');
    expect(router.location.query.unselectedSeries).toBeUndefined();
    unmount();
  });

  it('shows an error notice when dashboard details fail to load', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/123/',
      statusCode: 500,
    });

    renderEmbed({name: 'dashboard', data: {id: '123'}});

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load dashboard details.'
    );
  });
});
