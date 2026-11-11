import {Outlet} from 'react-router';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import AutomationsList, {getNextUpdate} from 'sentry/views/seerWorkflows/automations';
import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

import AutomationRuns from './detail/runs';
import AutomationDetail from './detail';

function getCard(title: string) {
  return within(screen.getByRole('heading', {name: title}).closest('li')!);
}

describe('AutomationsList', () => {
  const organization = OrganizationFixture({features: ['seer-automations']});
  const configsUrl = `/organizations/${organization.slug}/seer/workflows/configs/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend'}),
      ProjectFixture({id: '2', slug: 'backend'}),
    ]);
  });

  function mockConfigs(configs: SeerWorkflowConfigResponse[]) {
    return MockApiClient.addMockResponse({url: configsUrl, body: {configs}});
  }

  it('renders not found without seer-automations', async () => {
    const request = mockConfigs([SeerWorkflowConfigFixture({id: '1'})]);

    render(<AutomationsList />, {organization: OrganizationFixture()});

    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('renders a card for each automation returned by the API', async () => {
    mockConfigs([
      SeerWorkflowConfigFixture({id: '1', strategy: 'agentic_triage'}),
      SeerWorkflowConfigFixture({id: '2', strategy: 'custom_strategy'}),
    ]);

    render(<AutomationsList />, {organization});

    expect(
      await screen.findByRole('heading', {name: 'custom_strategy'})
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('heading', {name: 'Agentic triage'})).toBeInTheDocument();
    expect(
      screen.getByText('Automatically triage and fix the most fixable Issues.')
    ).toBeInTheDocument();
    expect(getCard('custom_strategy').getByText('No description')).toBeInTheDocument();
  });

  it('opens the selected automation and loads its run history', async () => {
    mockConfigs([
      SeerWorkflowConfigFixture({id: '42', strategy: 'breached_metric_investigation'}),
    ]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/workflows/runs/`,
      match: [MockApiClient.matchQuery({config: '42', per_page: 20})],
      body: {
        runs: [
          {
            id: '17',
            configId: '42',
            configName: null,
            strategy: 'breached_metric_investigation',
            dateAdded: '2025-04-20T00:00:00Z',
            dateUpdated: '2025-04-20T00:01:00Z',
            dateCompleted: '2025-04-20T00:01:00Z',
            executions: [],
            status: 'complete',
            trigger: null,
          },
        ],
      },
    });
    const {router} = render(<Outlet />, {
      organization,
      initialRouterConfig: {
        location: {pathname: '/organizations/org-slug/seer/automations/'},
        route: '/organizations/:orgId/seer/automations/',
        children: [
          {index: true, element: <AutomationsList />},
          {
            path: ':automationId/',
            element: <AutomationDetail />,
            children: [{path: 'runs/', element: <AutomationRuns />}],
          },
        ],
      },
    });

    await userEvent.click(await screen.findByRole('link', {name: /Breached metrics/}));
    await userEvent.click(await screen.findByRole('tab', {name: 'Runs'}));

    expect(router.location.pathname).toBe(
      '/organizations/org-slug/seer/automations/42/runs/'
    );
    expect(await screen.findByRole('img', {name: 'Succeeded'})).toBeInTheDocument();
  });

  it('shows an empty state when there are no automations', async () => {
    mockConfigs([]);

    render(<AutomationsList />, {organization});

    expect(await screen.findByText('No automations yet.')).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows a retry when configs fail to load', async () => {
    MockApiClient.addMockResponse({url: configsUrl, statusCode: 500});

    render(<AutomationsList />, {organization});

    expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('shows which projects each config covers', async () => {
    mockConfigs([
      SeerWorkflowConfigFixture({id: '1', strategy: 'all_strategy', projects: [-1]}),
      SeerWorkflowConfigFixture({id: '2', strategy: 'none_strategy', projects: []}),
      SeerWorkflowConfigFixture({
        id: '3',
        strategy: 'some_strategy',
        projects: [2, 99, 1],
      }),
    ]);

    render(<AutomationsList />, {organization});

    await screen.findByRole('heading', {name: 'some_strategy'});
    expect(getCard('all_strategy').getByText('All projects')).toBeInTheDocument();
    expect(getCard('none_strategy').getByText('No projects')).toBeInTheDocument();
    expect(getCard('some_strategy').getByText('backend, frontend')).toBeInTheDocument();
  });

  it('shows a next run tag only for daily configs', async () => {
    mockConfigs([
      SeerWorkflowConfigFixture({id: '1', strategy: 'daily_strategy', schedule: 'daily'}),
      SeerWorkflowConfigFixture({
        id: '2',
        strategy: 'weekly_strategy',
        schedule: 'weekly',
      }),
    ]);

    render(<AutomationsList />, {organization});

    await screen.findByRole('heading', {name: 'daily_strategy'});
    expect(getCard('daily_strategy').getByText(/Next run/)).toBeInTheDocument();
    expect(getCard('weekly_strategy').queryByText(/Next run/)).not.toBeInTheDocument();
  });

  it('shows a paused tag in place of the schedule for disabled configs', async () => {
    mockConfigs([
      SeerWorkflowConfigFixture({
        id: '1',
        strategy: 'paused_strategy',
        schedule: 'daily',
        enabled: false,
      }),
    ]);

    render(<AutomationsList />, {organization});

    await screen.findByRole('heading', {name: 'paused_strategy'});
    expect(getCard('paused_strategy').getByText('Paused')).toBeInTheDocument();
    expect(getCard('paused_strategy').queryByText(/Next run/)).not.toBeInTheDocument();
  });
  it('shows the creator avatar with a tooltip', async () => {
    mockConfigs([SeerWorkflowConfigFixture({id: '1', createdBy: '7'})]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/7/`,
      body: UserFixture({id: '7', name: 'Jane Doe', email: 'jane@example.com'}),
    });

    render(<AutomationsList />, {organization});

    const avatar = await screen.findByTestId('letter_avatar-avatar');
    await userEvent.hover(avatar);
    expect(
      await screen.findByText('Created by Jane Doe (jane@example.com)')
    ).toBeInTheDocument();
  });

  it('shows the Sentry icon with a tooltip when there is no creator', async () => {
    mockConfigs([SeerWorkflowConfigFixture({id: '1'})]);

    render(<AutomationsList />, {organization});

    const heading = await screen.findByRole('heading', {name: 'Agentic triage'});
    expect(screen.queryByTestId('letter_avatar-avatar')).not.toBeInTheDocument();
    await userEvent.hover(heading.nextElementSibling!.lastElementChild!);
    expect(await screen.findByText('Built and maintained by Sentry')).toBeInTheDocument();
  });

  describe('metric automations', () => {
    const detectorsUrl = `/organizations/${organization.slug}/detectors/`;

    function metricConfig(id: string, name: string, monitorIds: number[]) {
      return SeerWorkflowConfigFixture({
        id,
        name,
        strategy: 'breached_metric_investigation',
        monitorIds,
      });
    }

    // The tooltip stays disabled until monitors load, and enabling it remounts
    // the trigger, so query the trigger fresh once it is enabled
    async function hoverMonitors(text: string) {
      await waitFor(() =>
        expect(screen.getByText(text).closest('[aria-describedby]')).not.toBeNull()
      );
      await userEvent.hover(screen.getByText(text));
    }

    it('shows a monitor count in place of projects', async () => {
      mockConfigs([metricConfig('1', 'none', []), metricConfig('2', 'some', [1, 2, 3])]);
      MockApiClient.addMockResponse({url: detectorsUrl, body: []});

      render(<AutomationsList />, {organization});

      await screen.findByRole('heading', {name: 'some'});
      expect(getCard('none').getByText('No monitors')).toBeInTheDocument();
      expect(getCard('some').getByText('3 monitors')).toBeInTheDocument();
      expect(getCard('some').queryByText(/projects/)).not.toBeInTheDocument();
    });

    it('fetches the monitors of every card in one request', async () => {
      mockConfigs([
        metricConfig('1', 'first', [2, 1]),
        metricConfig('2', 'second', [1, 3]),
      ]);
      const request = MockApiClient.addMockResponse({
        url: detectorsUrl,
        match: [MockApiClient.matchQuery({id: ['1', '2', '3']})],
        body: [],
      });

      render(<AutomationsList />, {organization});

      await screen.findByRole('heading', {name: 'second'});
      expect(request).toHaveBeenCalledTimes(1);
    });

    it('lists monitor names as links on hover', async () => {
      mockConfigs([metricConfig('1', 'metrics', [1, 2])]);
      MockApiClient.addMockResponse({
        url: detectorsUrl,
        body: [
          MetricDetectorFixture({id: '1', name: 'Error rate'}),
          MetricDetectorFixture({id: '2', name: 'Latency'}),
        ],
      });

      render(<AutomationsList />, {organization});

      await hoverMonitors('2 monitors');
      expect((await screen.findByText('Error rate')).closest('a')).toHaveAttribute(
        'href',
        '/organizations/org-slug/monitors/1/'
      );
      expect(screen.getByText('Latency').closest('a')).toHaveAttribute(
        'href',
        '/organizations/org-slug/monitors/2/'
      );
    });

    it('shows five monitors and a remainder count for six or more', async () => {
      const ids = [1, 2, 3, 4, 5, 6, 7];
      mockConfigs([metricConfig('1', 'metrics', ids)]);
      MockApiClient.addMockResponse({
        url: detectorsUrl,
        body: ids.map(id =>
          MetricDetectorFixture({id: String(id), name: `Monitor ${id}`})
        ),
      });

      render(<AutomationsList />, {organization});

      await hoverMonitors('7 monitors');
      expect(await screen.findByText('Monitor 5')).toBeInTheDocument();
      expect(screen.queryByText('Monitor 6')).not.toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('does not show the tooltip until monitors load', async () => {
      mockConfigs([metricConfig('1', 'metrics', [1])]);
      MockApiClient.addMockResponse({
        url: detectorsUrl,
        body: [MetricDetectorFixture({id: '1', name: 'Error rate'})],
        asyncDelay: new Promise(() => {}),
      });

      render(<AutomationsList />, {organization});

      await userEvent.hover(await screen.findByText('1 monitor'));
      expect(screen.queryByText('Error rate')).not.toBeInTheDocument();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});

describe('getNextUpdate', () => {
  afterEach(() => {
    try {
      jest.runOnlyPendingTimers();
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns undefined for schedules other than daily', () => {
    jest.useFakeTimers({now: new Date('2026-10-23T09:00:00Z')});

    expect(getNextUpdate('weekly')).toBeUndefined();
    expect(getNextUpdate('')).toBeUndefined();
  });

  it.each([
    ['before 10:00', '2026-10-23T09:59:59Z', '2026-10-23T10:00:00.000Z'],
    ['at 10:00', '2026-10-23T10:00:00Z', '2026-10-23T22:00:00.000Z'],
    ['between 10:00 and 22:00', '2026-10-23T15:30:00Z', '2026-10-23T22:00:00.000Z'],
    ['at 22:00', '2026-10-23T22:00:00Z', '2026-10-24T10:00:00.000Z'],
    ['after 22:00', '2026-10-23T23:15:00Z', '2026-10-24T10:00:00.000Z'],
    [
      'after 22:00 at the end of a month',
      '2026-10-31T23:00:00Z',
      '2026-11-01T10:00:00.000Z',
    ],
    [
      'after 22:00 at the end of a year',
      '2026-12-31T23:00:00Z',
      '2027-01-01T10:00:00.000Z',
    ],
  ])('picks the next daily run %s UTC', (_, now, expected) => {
    jest.useFakeTimers({now: new Date(now)});

    expect(getNextUpdate('daily')?.toISOString()).toBe(expected);
  });
});
