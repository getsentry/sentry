import {AutomationFixture} from 'sentry-fixture/automations';
import {CheckInFixture} from 'sentry-fixture/checkIn';
import {
  CronDetectorFixture,
  MetricDetectorFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {UptimeCheckFixture} from 'sentry-fixture/uptimeCheck';
import {ActionHandlerFixture} from 'sentry-fixture/workflowEngine';

import {screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

function renderDetectorAlert(detector: Detector, kind: 'cron' | 'metric' | 'uptime') {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/detectors/${detector.id}/`,
    body: detector,
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/workflows/',
    body: [
      AutomationFixture({
        id: `automation-${detector.id}`,
        name: `${detector.name} notifications`,
      }),
    ],
  });

  return renderEmbed({
    name: 'alert',
    data: {id: detector.id, kind, name: detector.name},
  });
}

describe('alert embed', () => {
  it('points a metric alert at its detector', () => {
    expect(
      getEmbedLinkHref('alert', 'Checkout latency', {
        id: '4521',
        kind: 'metric',
        name: 'Checkout latency',
      })
    ).toBe('/organizations/org-slug/monitors/4521/');
  });

  it('points an issue alert at its automation', () => {
    expect(getEmbedLinkHref('alert', 'Alert 881', {id: '881', kind: 'issue'})).toBe(
      '/organizations/org-slug/monitors/alerts/881/'
    );
  });

  it('falls back to an id-based label when the API name is missing', () => {
    renderEmbed({
      name: 'alert',
      data: {id: '4521', kind: 'metric'},
      level: 'inline',
    });
    expect(screen.getByRole('link', {name: 'Alert 4521'})).toBeInTheDocument();
  });

  it('renders conditions and actions for an issue alert', async () => {
    const automation = AutomationFixture({
      id: '881',
      name: 'Checkout notifications',
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/workflows/${automation.id}/`,
      body: automation,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/available-actions/',
      body: [
        ActionHandlerFixture({
          integrations: [{id: 'integration-1', name: 'Checkout workspace'}],
        }),
      ],
    });

    renderEmbed({
      name: 'alert',
      data: {id: automation.id, kind: 'issue'},
    });

    expect(
      await screen.findByRole('link', {name: automation.name}, {timeout: 5_000})
    ).toHaveAttribute(
      'href',
      `/organizations/org-slug/monitors/alerts/${automation.id}/`
    );
    expect(screen.getByText('Issue alert - Enabled')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'Conditions and actions'})
    ).toBeInTheDocument();
    expect(await screen.findByText(/Checkout workspace/)).toBeInTheDocument();
  });

  it('renders metric data, conditions, and actions for a metric alert', async () => {
    const detector = MetricDetectorFixture({
      id: '4521',
      name: 'Checkout latency',
      latestGroup: null,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });
    const chartRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[Date.now() / 1000, [{count: 100}]]]},
    });

    renderDetectorAlert(detector, 'metric');

    expect(
      await screen.findByRole('link', {name: detector.name}, {timeout: 5_000})
    ).toBeInTheDocument();
    expect(await screen.findByText('Metric data')).toBeInTheDocument();
    await waitFor(() => expect(chartRequest).toHaveBeenCalled());
    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Rules'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Alert actions'})).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: `${detector.name} notifications`})
    ).toBeInTheDocument();
  });

  it('renders recent checks and conditions for an uptime alert', async () => {
    const project = ProjectFixture({id: '1'});
    const detector = UptimeDetectorFixture({
      id: '774',
      name: 'Checkout availability',
      latestGroup: null,
      projectId: project.id,
    });
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [],
    });
    const checksRequest = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/uptime/${detector.id}/checks/`,
      body: [
        UptimeCheckFixture({httpStatusCode: 200}),
        UptimeCheckFixture({
          uptimeCheckId: '2',
          traceItemId: '2',
          traceId: '22222222222222222222222222222222',
          httpStatusCode: 201,
        }),
        UptimeCheckFixture({
          uptimeCheckId: '3',
          traceItemId: '3',
          traceId: '33333333333333333333333333333333',
          httpStatusCode: 202,
        }),
      ],
    });

    renderDetectorAlert(detector, 'uptime');

    expect(
      await screen.findByText('Recent check-ins', {}, {timeout: 5_000})
    ).toBeInTheDocument();
    expect(await screen.findByText('202')).toBeInTheDocument();
    await waitFor(() =>
      expect(checksRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({per_page: 3}),
        })
      )
    );
    expect(screen.getByText('GET https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Creates an issue')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Alert actions'})).toBeInTheDocument();
  });

  it('renders an ongoing issue instead of recent checks for an uptime alert', async () => {
    const project = ProjectFixture({id: '1'});
    const detector = UptimeDetectorFixture({
      id: '775',
      name: 'Checkout availability',
      projectId: project.id,
    });
    const groupId = detector.latestGroup!.id;
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${groupId}/`,
      body: GroupFixture({id: groupId}),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });
    const checksRequest = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/uptime/${detector.id}/checks/`,
      body: [UptimeCheckFixture()],
    });

    renderDetectorAlert(detector, 'uptime');

    expect(
      await screen.findByText('Ongoing Issue', {}, {timeout: 5_000})
    ).toBeInTheDocument();
    expect((await screen.findAllByRole('table')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Recent check-ins')).not.toBeInTheDocument();
    expect(checksRequest).not.toHaveBeenCalled();
    expect(screen.getByText('GET https://example.com')).toBeInTheDocument();
  });

  it('renders recent check-ins and the schedule for a cron alert', async () => {
    const project = ProjectFixture({id: '1'});
    const detector = CronDetectorFixture({
      id: '9931',
      name: 'nightly-sync',
      latestGroup: null,
      projectId: project.id,
    });
    const monitor = detector.dataSources[0].queryObj;
    ProjectsStore.loadInitialData([project]);
    const checkInsRequest = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/monitors/${monitor.slug}/checkins/`,
      body: [CheckInFixture()],
    });

    renderDetectorAlert(detector, 'cron');

    expect(
      await screen.findByText('Recent check-ins', {}, {timeout: 5_000})
    ).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', {name: 'Status'})).toBeInTheDocument();
    await waitFor(() =>
      expect(checkInsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({per_page: 3}),
        })
      )
    );
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Monitor slug')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Alert actions'})).toBeInTheDocument();
  });
});
