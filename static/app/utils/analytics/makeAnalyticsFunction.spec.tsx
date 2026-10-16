describe('makeAnalyticsFunction', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does not throw when localStorage is unavailable', () => {
    // Firefox throws NS_ERROR_FAILURE on any localStorage access when its
    // storage is corrupted.
    jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('NS_ERROR_FAILURE');
    });

    jest.isolateModules(() => {
      const {
        makeAnalyticsFunction,
      } = require('sentry/utils/analytics/makeAnalyticsFunction');
      const trackEvent = makeAnalyticsFunction({'test.event': 'Test Event'});

      expect(() => trackEvent('test.event', {organization: null})).not.toThrow();
    });
  });
});
