import {
  getCreateAlertForLabel,
  getCreateAlertLabel,
  getSaveAsAlertMenuItem,
} from 'sentry/views/explore/utils/saveAsAlertMenuItem';

describe('getCreateAlertLabel', () => {
  it('returns the monitor label', () => {
    expect(getCreateAlertLabel()).toBe('Create a Monitor');
  });
});

describe('getCreateAlertForLabel', () => {
  it('returns the monitor for label', () => {
    expect(getCreateAlertForLabel()).toBe('Create a Monitor for');
  });
});

describe('getSaveAsAlertMenuItem', () => {
  const alertsUrls = [{key: 'count()-0', label: 'count()', to: '/alert/'}];

  it('is enabled with children when there are aggregates', () => {
    const item = getSaveAsAlertMenuItem({alertsUrls, submenu: true});

    expect(item).toEqual(
      expect.objectContaining({
        label: 'Monitor for',
        textValue: 'Monitor for',
        disabled: false,
        children: alertsUrls,
        submenu: true,
      })
    );
  });

  it('is disabled when there are no aggregates', () => {
    const item = getSaveAsAlertMenuItem({alertsUrls: [], submenu: true});

    expect(item.disabled).toBe(true);
  });

  it('uses the given label when one is provided', () => {
    const item = getSaveAsAlertMenuItem({
      alertsUrls,
      submenu: true,
      label: 'Create a Monitor for',
    });

    expect(item.label).toBe('Create a Monitor for');
    expect(item.textValue).toBe('Create a Monitor for');
  });

  it('is disabled when the caller disables the submenu', () => {
    const item = getSaveAsAlertMenuItem({alertsUrls, disabled: true, submenu: true});

    expect(item.disabled).toBe(true);
  });

  it('returns an actionable item with no children when not a submenu', () => {
    const onAction = jest.fn();

    const item = getSaveAsAlertMenuItem({to: '/alert/', onAction});

    expect(item).toEqual(
      expect.objectContaining({
        label: 'Create a Monitor',
        textValue: 'Create a Monitor',
        to: '/alert/',
        onAction,
      })
    );
    expect(item.disabled).toBeFalsy();
    expect(item.children).toBeUndefined();
  });

  it('is disabled when the caller disables the action item', () => {
    const item = getSaveAsAlertMenuItem({
      disabled: true,
      to: '/alert/',
      onAction: jest.fn(),
    });

    expect(item.disabled).toBe(true);
  });
});
