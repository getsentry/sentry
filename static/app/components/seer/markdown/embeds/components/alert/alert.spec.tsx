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

function renderDetectorAlert(
  detector: Detector,
  kind: 'cron' | 'metric' | 'uptime',
  alertRuleId = detector.id
) {
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
    data: {id: alertRuleId, detectorId: detector.id, kind, name: detector.name},
  });
}

describe('alert embed', () => {
  it('points a metric alert at its detector', () => {
    expect(
      getEmbedLinkHref('alert', 'Checkout latency', {
        id: '4521',
        detectorId: '9812',
        kind: 'metric',
        name: 'Checkout latency',
      })
    ).toBe('/organizations/org-slug/monitors/9812/');
  });

  it('points an issue alert at its automation', () => {
    expect(getEmbedLinkHref('alert', 'Alert 881', {id: '881', kind: 'issue'})).toBe(
      '/organizations/org-slug/monitors/alerts/881/'
    );
  });

  it('points a metric alert without a detector ID at the legacy alert route', () => {
    renderEmbed({
      name: 'alert',
      data: {id: '4521', kind: 'metric'},
      level: 'inline',
    });

    expect(screen.getByRole('link', {name: 'Alert 4521'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/alerts/rules/details/4521/'
    );
  });

  it('points an uptime alert at its own id, which is already a detector id', () => {
    expect(
      getEmbedLinkHref('alert', 'Checkout availability', {
        id: '774',
        kind: 'uptime',
        name: 'Checkout availability',
      })
    ).toBe('/organizations/org-slug/monitors/774/');
  });

  it('does not link a cron alert whose id is a monitor GUID', () => {
    renderEmbed({
      name: 'alert',
      data: {id: '3f8c1e2a-5b47-4d90-9a13-7c2e5f4b8d61', kind: 'cron', name: 'Nightly'},
      level: 'inline',
    });

    // The monitors route would 404 on a GUID and the legacy cron route needs a
    // project the embed does not carry, so the name renders unlinked.
    expect(screen.getByText('Nightly')).toBeInTheDocument();
    expect(screen.queryByRole('link', {name: 'Nightly'})).not.toBeInTheDocument();
  });

  it('resolves a legacy metric alert to its detector', async () => {
    const detector = MetricDetectorFixture({id: '9812', name: 'Checkout latency'});
    const lookup = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rule-detector/',
      body: {detectorId: '9812', alertRuleId: '4521', ruleId: null},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/9812/',
      body: detector,
    });
    MockApiClient.addMockResponse({url: '/organizations/org-slug/workflows/', body: []});

    renderEmbed({name: 'alert', data: {id: '4521', kind: 'metric'}});

    expect(await screen.findByText('Dataset:')).toBeInTheDocument();
    expect(lookup).toHaveBeenCalledWith(
      '/organizations/org-slug/alert-rule-detector/',
      expect.objectContaining({query: expect.objectContaining({alert_rule_id: '4521'})})
    );
  });

  it('falls back to the legacy message when no detector is dual-written', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rule-detector/',
      statusCode: 404,
      body: {detail: 'The requested resource does not exist'},
    });

    renderEmbed({name: 'alert', data: {id: '4521', kind: 'metric'}});

    expect(
      await screen.findByText('Alert details are unavailable for legacy alerts.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Unable to load alert details.')).not.toBeInTheDocument();
  });

  it('does not attempt a detector lookup for a legacy cron alert', async () => {
    const lookup = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rule-detector/',
      body: {detectorId: '9931', alertRuleId: null, ruleId: null},
    });

    renderEmbed({
      name: 'alert',
      data: {id: '3f8c1e2a-5b47-4d90-9a13-7c2e5f4b8d61', kind: 'cron'},
    });

    // A monitor GUID is not an alert rule id, so there is nothing to look it up
    // against -- the endpoint would reject it outright.
    expect(
      await screen.findByText('Alert details are unavailable for legacy alerts.')
    ).toBeInTheDocument();
    expect(lookup).not.toHaveBeenCalled();
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

    renderDetectorAlert(detector, 'metric', 'legacy-alert-rule-id');

    expect(
      await screen.findByRole('link', {name: detector.name}, {timeout: 5_000})
    ).toHaveAttribute('href', `/organizations/org-slug/monitors/${detector.id}/`);
    expect(await screen.findByText('Dataset:')).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Rules'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Alert actions'})).toBeInTheDocument();
    // The automations load independently of the detector, so this arrives on
    // its own tick rather than with the rest of the preview.
    expect(
      await screen.findByRole('link', {name: `${detector.name} notifications`})
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
