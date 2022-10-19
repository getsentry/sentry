import ConfigStore from 'sentry/stores/configStore';

describe('ConfigStore', () => {
  it('should have apiUrl and organizationUrl', () => {
    const links = ConfigStore.get('links');
    expect(links).toEqual({
      organizationUrl: 'https://foobar.sentry.io',
      regionUrl: 'https://us.sentry.io',
      sentryUrl: 'https://sentry.io',
    });
  });

  it('should have cookie names', () => {
    const csrfCookieName = ConfigStore.get('csrfCookieName');
    expect(csrfCookieName).toEqual('csrf-test-cookie');

    const superUserCookieName = ConfigStore.get('superUserCookieName');
    expect(superUserCookieName).toEqual('su-test-cookie');
  });
});
