import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  getCreateAlertLabel,
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

describe('getCreateAlertLabel', () => {
  it('returns the alert label when workflow engine is disabled', () => {
    const organization = OrganizationFixture({features: []});

    expect(getCreateAlertLabel(organization)).toBe('Create an Alert');
  });

  it('returns the monitor label when workflow engine is enabled', () => {
    const organization = OrganizationFixture({features: ['workflow-engine-ui']});

    expect(getCreateAlertLabel(organization)).toBe('Create a Monitor');
  });
});

describe('getSaveAsAlertMenuItem', () => {
  const alertsUrls = [{key: 'count()-0', label: 'count()', to: '/alert/'}];

  it('is enabled with children when the organization has metric alerts', () => {
    const organization = OrganizationFixture({features: ['incidents']});

    const item = getSaveAsAlertMenuItem({organization, alertsUrls});

    expect(item).toEqual(
      expect.objectContaining({
        label: 'Alert for',
        disabled: false,
        tooltip: undefined,
        children: alertsUrls,
      })
    );
  });

  it('is disabled with an upsell tooltip when metric alerts are unavailable', () => {
    const organization = OrganizationFixture({features: []});

    const item = getSaveAsAlertMenuItem({organization, alertsUrls});

    expect(item).toEqual(
      expect.objectContaining({
        disabled: true,
        tooltip: 'Alerts are not available on your current plan.',
        children: [],
      })
    );
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
