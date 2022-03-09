import MetricsTagStore from 'sentry/stores/metricsTagStore';

describe('MetricsTagStore', function () {
  beforeEach(() => {
    MetricsTagStore.reset();
  });

  describe('onLoadSuccess()', () => {
    it('should add a new tags and trigger the new addition', () => {
      jest.spyOn(MetricsTagStore, 'trigger');

      const {metricsTags} = MetricsTagStore.getState();
      expect(metricsTags).toEqual({});

      MetricsTagStore.onLoadSuccess([
        {key: 'environment'},
        {key: 'release'},
        {key: 'session.status'},
      ]);

      const {metricsTags: metricsNewTags} = MetricsTagStore.getState();
      expect(metricsNewTags).toEqual({
        environment: {key: 'environment'},
        release: {key: 'release'},
        'session.status': {key: 'session.status'},
      });

      expect(MetricsTagStore.trigger).toHaveBeenCalledTimes(1);
    });
  });
});
