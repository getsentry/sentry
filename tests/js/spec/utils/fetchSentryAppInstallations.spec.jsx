import fetchSentryAppInstallations from 'app/utils/fetchSentryAppInstallations';

describe('fetchSentryAppInstallations', () => {
  it('handles installs 404 gracefully', () => {
    MockApiClient.addMockResponse({
      url: '/sentry-apps/',
      status: 404,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/foo/sentry-app-installations/',
      status: 404,
    });

    // Doesn't throw an exception
    fetchSentryAppInstallations('foo');
  });
});
