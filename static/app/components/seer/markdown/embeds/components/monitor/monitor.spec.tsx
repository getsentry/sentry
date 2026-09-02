import {screen} from 'sentry-test/reactTestingLibrary';

import {
  STORY_CRON_DETECTOR,
  STORY_ERROR_DETECTOR,
  STORY_METRIC_DETECTOR,
  STORY_MOBILE_BUILD_DETECTOR,
  STORY_UPTIME_DETECTOR,
} from 'sentry/components/seer/markdown/embeds/components/monitor/fixtures';
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
    renderMonitor(STORY_ERROR_DETECTOR);

    expect(await screen.findByText('Rules')).toBeInTheDocument();
    expect(screen.getByText('Detect')).toBeInTheDocument();
    expect(screen.getByText('Assign')).toBeInTheDocument();
    expect(screen.getByText('Prioritize')).toBeInTheDocument();
  });

  it('renders the query and thresholds for a metric monitor', async () => {
    renderMonitor(STORY_METRIC_DETECTOR);

    expect(await screen.findByText('Rules')).toBeInTheDocument();
    expect(await screen.findByText('Dataset:')).toBeInTheDocument();
    expect(screen.getByText('Threshold:')).toBeInTheDocument();
    expect(screen.queryByText('Metric data')).not.toBeInTheDocument();
  });

  it('renders configuration for an uptime monitor', async () => {
    renderMonitor(STORY_UPTIME_DETECTOR);

    expect(await screen.findByText('Monitor configuration')).toBeInTheDocument();
    expect(await screen.findByText('GET https://example.com/health')).toBeInTheDocument();
    expect(screen.getByText('Interval')).toBeInTheDocument();
    expect(screen.getByText('Creates an issue')).toBeInTheDocument();
    expect(screen.queryByText('Recent check-ins')).not.toBeInTheDocument();
  });

  it('renders the schedule for a cron monitor', async () => {
    renderMonitor(STORY_CRON_DETECTOR);

    expect(await screen.findByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Monitor slug')).toBeInTheDocument();
    expect(screen.getByText('Last check-in')).toBeInTheDocument();
    expect(screen.queryByText('Recent check-ins')).not.toBeInTheDocument();
  });

  it('renders thresholds for a mobile build monitor', async () => {
    renderMonitor(STORY_MOBILE_BUILD_DETECTOR);

    expect(await screen.findByText('Rules')).toBeInTheDocument();
    expect(await screen.findByText('Measurement:')).toBeInTheDocument();
    expect(screen.getByText('Threshold Type:')).toBeInTheDocument();
    expect(screen.queryByText('Ongoing Issue')).not.toBeInTheDocument();
  });
});
