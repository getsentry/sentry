import * as Sentry from '@sentry/browser';

describe('bootstrap', function() {
  it('configures Sentry', async function() {
    window.__initialData = {
      distPrefix: 'dist',
      csrfCookieName: 'csrf',
      userIdentity: {
        id: 1,
        email: 'foo@example.com',
      },
      sentryConfig: {
        dsn: 'https://public@example.com/1',
        environment: 'development',
        release: '123',
      },
    };

    require('app');

    const eventId = await Sentry.captureMessage('test');
    expect(eventId).toBeDefined();
    expect(Sentry.testkit.reports()).toHaveLength(1);
    const {originalReport} = Sentry.testkit.reports()[0];
    expect(originalReport).toHaveProperty('release');
    expect(originalReport.release).toEqual('123');
    expect(originalReport).toHaveProperty('environment');
    expect(originalReport.environment).toEqual('development');
    expect(originalReport).toHaveProperty('user');
    expect(originalReport.user.id).toEqual(1);
    expect(originalReport.user.email).toEqual('foo@example.com');
  });
});
