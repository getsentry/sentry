import {CheckInFixture} from 'sentry-fixture/checkIn';
import {
  CronDetectorFixture,
  ErrorDetectorFixture,
  MetricDetectorFixture,
  PreprodDetectorFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {UptimeCheckFixture} from 'sentry-fixture/uptimeCheck';

import {screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Detector} from 'sentry/types/workflowEngine/detectors';

function renderMonitor(detector: Detector, data: Record<string, unknown> = {}) {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/detectors/${detector.id}/`,
    body: detector,
  });

  return renderEmbed({
    name: 'monitor',
    data: {id: detector.id, name: detector.name, ...data},
  });
}

describe('Seer monitor embed', () => {
  it('links to the detector detail page inline', () => {
    expect(
      getEmbedLinkHref('monitor', 'nightly-sync', {id: '9931', name: 'nightly-sync'})
    ).toBe('/organizations/org-slug/monitors/9931/');
  });

  it('renders unresolved issues for an error monitor', async () => {
    const detector = ErrorDetectorFixture({id: '2', latestGroup: null});
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    const issuesRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [],
    });

    renderMonitor(detector, {statsPeriod: '7d'});

    await waitFor(() =>
      expect(issuesRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: `is:unresolved detector:${detector.id}`,
            statsPeriod: '7d',
          }),
        })
      )
    );
  });

  it('renders the chart, query, and thresholds for a metric monitor', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });
    const chartRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: {data: [[Date.now() / 1000, [{count: 100}]]]},
    });

    renderMonitor(
      MetricDetectorFixture({
        id: '3',
        name: 'Request volume',
        latestGroup: null,
      })
    );

    expect(await screen.findByText('Metric data')).toBeInTheDocument();
    await waitFor(() => expect(chartRequest).toHaveBeenCalled());
    expect(await screen.findByTestId('area-chart')).toBeInTheDocument();
    expect(await screen.findByText('Dataset:')).toBeInTheDocument();
    expect(screen.getByText('Threshold:')).toBeInTheDocument();
  });

  it('renders the three most recent checks and configuration for an uptime monitor', async () => {
    const project = ProjectFixture({id: '1'});
    const detector = UptimeDetectorFixture({
      id: '4',
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
        UptimeCheckFixture({
          uptimeCheckId: '1',
          traceItemId: '1',
          traceId: '11111111111111111111111111111111',
          httpStatusCode: 200,
        }),
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

    renderMonitor(detector);

    expect(await screen.findByText('Recent check-ins')).toBeInTheDocument();
    expect(await screen.findByText('202')).toBeInTheDocument();
    await waitFor(() =>
      expect(checksRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({per_page: 3}),
        })
      )
    );
    expect(await screen.findByText('GET https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Interval')).toBeInTheDocument();
    expect(screen.getByText('Creates an issue')).toBeInTheDocument();
  });

  it('renders an ongoing issue instead of recent checks for an uptime monitor', async () => {
    const project = ProjectFixture({id: '1'});
    const detector = UptimeDetectorFixture({id: '7', projectId: project.id});
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

    renderMonitor(detector);

    expect(await screen.findByText('Ongoing Issue')).toBeInTheDocument();
    expect((await screen.findAllByRole('table')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Recent check-ins')).not.toBeInTheDocument();
    expect(checksRequest).not.toHaveBeenCalled();
    expect(screen.getByText('GET https://example.com')).toBeInTheDocument();
  });

  it('renders recent check-ins and the schedule for a cron monitor', async () => {
    const project = ProjectFixture({id: '1'});
    const detector = CronDetectorFixture({
      id: '5',
      latestGroup: null,
      projectId: project.id,
    });
    const monitor = detector.dataSources[0].queryObj;
    ProjectsStore.loadInitialData([project]);
    const checkInsRequest = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/monitors/${monitor.slug}/checkins/`,
      body: [CheckInFixture()],
    });

    renderMonitor(detector);

    expect(await screen.findByText('Recent check-ins')).toBeInTheDocument();
    expect(await screen.findByRole('columnheader', {name: 'Status'})).toBeInTheDocument();
    await waitFor(() =>
      expect(checkInsRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({per_page: 3}),
        })
      )
    );
    expect(await screen.findByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Monitor slug')).toBeInTheDocument();
    expect(screen.getByText('Last check-in')).toBeInTheDocument();
  });

  it('renders ongoing issues and thresholds for a mobile build monitor', async () => {
    const detector = PreprodDetectorFixture({id: '6'});
    const groupId = detector.latestGroup!.id;
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

    renderMonitor(detector);

    expect(await screen.findByText('Ongoing Issue')).toBeInTheDocument();
    expect((await screen.findAllByRole('table')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Measurement:')).toBeInTheDocument();
    expect(screen.getByText('Threshold Type:')).toBeInTheDocument();
  });
});
