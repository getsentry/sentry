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
});
