import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  getMetricAlertsUpsellTooltip,
  getSaveAsAlertMenuItem,
} from 'sentry/views/explore/utils/saveAsAlertMenuItem';

describe('getMetricAlertsUpsellTooltip', () => {
  it('returns undefined when the organization has metric alerts', () => {
    const organization = OrganizationFixture({features: ['incidents']});

    expect(getMetricAlertsUpsellTooltip(organization)).toBeUndefined();
  });

  it('returns an alert upsell message when metric alerts are unavailable', () => {
    const organization = OrganizationFixture({features: []});

    expect(getMetricAlertsUpsellTooltip(organization)).toBe(
      'Alerts are not available on your current plan.'
    );
  });

  it('returns a monitor upsell message when workflow engine is enabled', () => {
    const organization = OrganizationFixture({features: ['workflow-engine-ui']});

    expect(getMetricAlertsUpsellTooltip(organization)).toBe(
      'Monitors are not available on your current plan.'
    );
  });
});

describe('getSaveAsAlertMenuItem', () => {
  const alertsUrls = [{key: 'count()-0', label: 'count()', to: '/alert/'}];

  it('is enabled with children when the organization has metric alerts', () => {
    const organization = OrganizationFixture({features: ['incidents']});

    const item = getSaveAsAlertMenuItem({organization, alertsUrls});

    expect(item.label).toBe('Alert for');
    expect(item.disabled).toBe(false);
    expect(item.tooltip).toBeUndefined();
    expect(item.children).toEqual(alertsUrls);
  });

  it('is disabled with an upsell tooltip when metric alerts are unavailable', () => {
    const organization = OrganizationFixture({features: []});

    const item = getSaveAsAlertMenuItem({organization, alertsUrls});

    expect(item.disabled).toBe(true);
    expect(item.tooltip).toBe('Alerts are not available on your current plan.');
    expect(item.children).toEqual([]);
  });

  it('is disabled when the organization has metric alerts but no aggregates', () => {
    const organization = OrganizationFixture({features: ['incidents']});

    const item = getSaveAsAlertMenuItem({organization, alertsUrls: []});

    expect(item.disabled).toBe(true);
    expect(item.tooltip).toBeUndefined();
  });

  it('uses the monitor label when workflow engine is enabled', () => {
    const organization = OrganizationFixture({
      features: ['incidents', 'workflow-engine-ui'],
    });

    const item = getSaveAsAlertMenuItem({organization, alertsUrls});

    expect(item.label).toBe('Monitor for');
  });
});
