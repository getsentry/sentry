import MetricsMetaStore from 'sentry/stores/metricsMetaStore';

describe('MetricsMetaStore', function () {
  beforeEach(() => {
    MetricsMetaStore.reset();
  });

  describe('onLoadSuccess()', () => {
    it('should add a new fields and trigger the new addition', () => {
      jest.spyOn(MetricsMetaStore, 'trigger');

      const fields = MetricsMetaStore.getAllFields();
      expect(fields).toEqual({});

      MetricsMetaStore.onLoadSuccess([
        {
          name: 'sentry.sessions.session',
          type: 'counter',
          operations: ['sum'],
          unit: null,
        },
        {
          name: 'sentry.sessions.session.error',
          type: 'set',
          operations: ['count_unique'],
          unit: null,
        },
      ]);

      const updatedFields = MetricsMetaStore.getAllFields();
      expect(updatedFields).toEqual({
        'sentry.sessions.session': {
          name: 'sentry.sessions.session',
          type: 'counter',
          operations: ['sum'],
          unit: null,
        },
        'sentry.sessions.session.error': {
          name: 'sentry.sessions.session.error',
          type: 'set',
          operations: ['count_unique'],
          unit: null,
        },
      });

      expect(MetricsMetaStore.trigger).toHaveBeenCalledTimes(1);
    });
  });
});
