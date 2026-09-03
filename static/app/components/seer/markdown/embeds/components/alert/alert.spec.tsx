import {AutomationFixture} from 'sentry-fixture/automations';
import {
  CronDetectorFixture,
  MetricDetectorFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';
import {ActionHandlerFixture} from 'sentry-fixture/workflowEngine';

import {screen} from 'sentry-test/reactTestingLibrary';

import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';
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

  it('renders rules and actions for a metric alert', async () => {
    const detector = MetricDetectorFixture({
      id: '4521',
      name: 'Checkout latency',
      latestGroup: null,
    });

    renderDetectorAlert(detector, 'metric');

    expect(
      await screen.findByRole('link', {name: detector.name}, {timeout: 5_000})
    ).toBeInTheDocument();
    expect(await screen.findByText('Dataset:')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Rules'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Alert actions'})).toBeInTheDocument();
    expect(
      screen.getByRole('link', {name: `${detector.name} notifications`})
    ).toBeInTheDocument();
    expect(screen.queryByText('Metric data')).not.toBeInTheDocument();
  });

  it('renders configuration and actions for an uptime alert', async () => {
    const detector = UptimeDetectorFixture({
      id: '774',
      name: 'Checkout availability',
      latestGroup: null,
    });

    renderDetectorAlert(detector, 'uptime');

    expect(
      await screen.findByText('Monitor configuration', {}, {timeout: 5_000})
    ).toBeInTheDocument();
    expect(screen.getByText('GET https://example.com')).toBeInTheDocument();
    expect(screen.getByText('Creates an issue')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Alert actions'})).toBeInTheDocument();
    expect(screen.queryByText('Recent check-ins')).not.toBeInTheDocument();
  });

  it('renders the schedule and actions for a cron alert', async () => {
    const detector = CronDetectorFixture({
      id: '9931',
      name: 'nightly-sync',
      latestGroup: null,
    });

    renderDetectorAlert(detector, 'cron');

    expect(await screen.findByText('Schedule', {}, {timeout: 5_000})).toBeInTheDocument();
    expect(screen.getByText('Monitor slug')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Alert actions'})).toBeInTheDocument();
    expect(screen.queryByText('Recent check-ins')).not.toBeInTheDocument();
  });
});
