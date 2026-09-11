import * as Sentry from '@sentry/react';
import {
  CronDetectorFixture,
  ErrorDetectorFixture,
  IssueStreamDetectorFixture,
  MetricDetectorFixture,
  PreprodDetectorFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';

import {screen} from 'sentry-test/reactTestingLibrary';

import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';
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

  it('renders configuration rules for an error monitor', async () => {
    const detector = ErrorDetectorFixture({id: '2', latestGroup: null});

    renderMonitor(detector);

    expect(await screen.findByText('Rules')).toBeInTheDocument();
    expect(screen.getByText('Detect')).toBeInTheDocument();
    expect(screen.getByText('Assign')).toBeInTheDocument();
    expect(screen.getByText('Prioritize')).toBeInTheDocument();
  });

  it('renders the query and thresholds for a metric monitor', async () => {
    renderMonitor(
      MetricDetectorFixture({
        id: '3',
        name: 'Request volume',
        latestGroup: null,
      })
    );

    expect(await screen.findByText('Rules')).toBeInTheDocument();
    expect(await screen.findByText('Dataset:')).toBeInTheDocument();
    expect(screen.getByText('Threshold:')).toBeInTheDocument();
    expect(screen.queryByText('Metric data')).not.toBeInTheDocument();
  });

  it('renders configuration for an uptime monitor', async () => {
    const detector = UptimeDetectorFixture({id: '4', latestGroup: null});

    renderMonitor(detector);

    expect(await screen.findByText('Monitor configuration')).toBeInTheDocument();
    expect(await screen.findByText('GET https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Interval')).toBeInTheDocument();
    expect(screen.getByText('Creates an issue')).toBeInTheDocument();
    expect(screen.queryByText('Recent check-ins')).not.toBeInTheDocument();
  });

  it('renders the schedule for a cron monitor', async () => {
    const detector = CronDetectorFixture({id: '5', latestGroup: null});

    renderMonitor(detector);

    expect(await screen.findByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Monitor slug')).toBeInTheDocument();
    expect(screen.getByText('Last check-in')).toBeInTheDocument();
    expect(screen.queryByText('Recent check-ins')).not.toBeInTheDocument();
  });

  it('renders thresholds for a mobile build monitor', async () => {
    const detector = PreprodDetectorFixture({id: '6', latestGroup: null});

    renderMonitor(detector);

    expect(await screen.findByText('Rules')).toBeInTheDocument();
    expect(await screen.findByText('Measurement:')).toBeInTheDocument();
    expect(screen.getByText('Threshold Type:')).toBeInTheDocument();
    expect(screen.queryByText('Ongoing Issue')).not.toBeInTheDocument();
  });

  it('renders no configuration for a project monitor', async () => {
    const detector = IssueStreamDetectorFixture({id: '7', latestGroup: null});

    renderMonitor(detector);

    expect(await screen.findByText('Project')).toBeInTheDocument();
    expect(screen.queryByText('Rules')).not.toBeInTheDocument();
  });

  it('shows a disabled tag separately from the neutral type tag', async () => {
    const detector = ErrorDetectorFixture({id: '9', latestGroup: null, enabled: false});

    renderMonitor(detector);

    expect(await screen.findByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
  });

  it('reports and shows an error for an unrecognized detector type', async () => {
    const captureException = jest.spyOn(Sentry, 'captureException');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const detector = {
      ...ErrorDetectorFixture({id: '8', latestGroup: null}),
      type: 'made_up_type',
    } as unknown as Detector;

    renderMonitor(detector);

    expect(await screen.findByText('Unsupported monitor type.')).toBeInTheDocument();

    if (process.env.NODE_ENV === 'development') {
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[Monitor] unknown detector type: made_up_type')
      );
      expect(captureException).not.toHaveBeenCalled();
    } else {
      expect(captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: '[Monitor] unknown detector type: made_up_type',
        })
      );
    }

    captureException.mockRestore();
    warn.mockRestore();
  });
});
