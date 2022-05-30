import ConfigStore from 'sentry/stores/configStore';

describe('ConfigStore', () => {
  it('should have apiUrl and organizationUrl', () => {
    expect(ConfigStore.get('sentryUrl')).toEqual('https://sentry.io');
    expect(ConfigStore.get('organizationUrl')).toEqual('https://foobar.sentry.io');
  });
});
