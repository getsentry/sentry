import type {Config} from 'sentry/types/system';

import {ConfigStore} from './configStore';

describe('ConfigStore', () => {
  let configState: Config;
  beforeEach(() => {
    configState = ConfigStore.getState();
  });

  afterEach(() => {
    ConfigStore.loadInitialData(configState);
  });

  it('should have regionUrl and organizationUrl', () => {
    const links = ConfigStore.get('links');
    expect(links).toEqual({
      organizationUrl: undefined,
      regionUrl: undefined,
      sentryUrl: 'https://sentry.io',
    });
  });

  it('should have cookie names', () => {
    const csrfCookieName = ConfigStore.get('csrfCookieName');
    expect(csrfCookieName).toBe('csrf-test-cookie');

    const superUserCookieName = ConfigStore.get('superUserCookieName');
    expect(superUserCookieName).toBe('su-test-cookie');
  });

  it('should have customerDomain', () => {
    expect(ConfigStore.get('customerDomain')).toBeNull();
  });

  it('notifies subscribers when a value is set', () => {
    const listener = jest.fn();
    const unsubscribe = ConfigStore.subscribe(listener);

    ConfigStore.set('theme', 'dark');

    expect(ConfigStore.get('theme')).toBe('dark');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('returns a stable reference from getState()', () => {
    ConfigStore.set('theme', 'dark');
    const state = ConfigStore.getState();
    expect(Object.is(state, ConfigStore.getState())).toBe(true);
  });
});
