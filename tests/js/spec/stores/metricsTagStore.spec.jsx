import MetricsTagStore from 'sentry/stores/metricsTagStore';

describe('MetricsTagStore', function () {
  beforeEach(() => {
    MetricsTagStore.reset();
  });

  describe('onLoadTagsSuccess()', () => {
    it('should add a new tags and trigger the new addition', () => {
      jest.spyOn(MetricsTagStore, 'trigger');

      const tags = MetricsTagStore.getAllTags();
      expect(tags).toEqual({});

      MetricsTagStore.onLoadTagsSuccess([
        {key: 'environment'},
        {key: 'release'},
        {key: 'session.status'},
      ]);

      const updatedTags = MetricsTagStore.getAllTags();
      expect(updatedTags).toEqual({
        environment: {key: 'environment'},
        release: {key: 'release'},
        'session.status': {key: 'session.status'},
      });

      expect(MetricsTagStore.trigger).toHaveBeenCalledTimes(1);
    });
  });
});
