import ConfigStore from 'sentry/stores/configStore';
import type {Config} from 'sentry/types/system';

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

  it('returns a stable reference from getState()', () => {
    ConfigStore.set('theme', 'dark');
    const state = ConfigStore.getState();
    expect(Object.is(state, ConfigStore.getState())).toBe(true);
  });
});
