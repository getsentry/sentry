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

  it('returns a monitor upsell message when metric alerts are unavailable', () => {
    const organization = OrganizationFixture({features: []});

    expect(getMetricAlertsUpsellTooltip(organization)).toBe(
      'Monitors are not available on your current plan.'
    );
  });
});

describe('getCreateAlertLabel', () => {
  it('returns the monitor label', () => {
    expect(getCreateAlertLabel()).toBe('Create a Monitor');
  });
});

describe('getSaveAsAlertMenuItem', () => {
  const alertsUrls = [{key: 'count()-0', label: 'count()', to: '/alert/'}];

  it('is enabled with children when the organization has metric alerts', () => {
    const organization = OrganizationFixture({features: ['incidents']});

    const item = getSaveAsAlertMenuItem({organization, alertsUrls, submenu: true});

    expect(item).toEqual(
      expect.objectContaining({
        label: 'Monitor for',
        disabled: false,
        tooltip: undefined,
        children: alertsUrls,
      })
    );
  });

  it('is disabled with an upsell tooltip when metric alerts are unavailable', () => {
    const organization = OrganizationFixture({features: []});

    const item = getSaveAsAlertMenuItem({organization, alertsUrls, submenu: true});

    expect(item).toEqual(
      expect.objectContaining({
        disabled: true,
        tooltip: 'Monitors are not available on your current plan.',
        children: [],
      })
    );
  });

  it('is disabled when the organization has metric alerts but no aggregates', () => {
    const organization = OrganizationFixture({features: ['incidents']});

    const item = getSaveAsAlertMenuItem({organization, alertsUrls: [], submenu: true});

    expect(item.disabled).toBe(true);
    expect(item.tooltip).toBeUndefined();
  });

  it('uses the given label when one is provided', () => {
    const organization = OrganizationFixture({features: ['incidents']});

    const item = getSaveAsAlertMenuItem({
      organization,
      alertsUrls,
      submenu: true,
      label: 'Create a Monitor for',
    });

    expect(item.label).toBe('Create a Monitor for');
  });

  it('returns an actionable item with no children when not a submenu', () => {
    const organization = OrganizationFixture({features: ['incidents']});
    const onAction = jest.fn();

    const item = getSaveAsAlertMenuItem({organization, to: '/alert/', onAction});

    expect(item).toEqual(
      expect.objectContaining({
        label: 'Create a Monitor',
        disabled: false,
        tooltip: undefined,
        to: '/alert/',
        onAction,
      })
    );
    expect(item.children).toBeUndefined();
  });

  it('is disabled with an upsell tooltip when not a submenu and metric alerts are unavailable', () => {
    const organization = OrganizationFixture({features: []});

    const item = getSaveAsAlertMenuItem({
      organization,
      to: '/alert/',
      onAction: jest.fn(),
    });

    expect(item.disabled).toBe(true);
    expect(item.tooltip).toBe('Monitors are not available on your current plan.');
  });

  it('is disabled when the caller disables it for an unrelated reason', () => {
    const organization = OrganizationFixture({features: ['incidents']});

    const item = getSaveAsAlertMenuItem({
      organization,
      disabled: true,
      to: '/alert/',
      onAction: jest.fn(),
    });

    expect(item.disabled).toBe(true);
    expect(item.tooltip).toBeUndefined();
  });
});
