import CustomMeasurementsStore from 'sentry/stores/customMeasurementsStore';

describe('CustomMeasurementsStore', function () {
  beforeEach(() => {
    CustomMeasurementsStore.reset();
  });

  afterEach(() => {});

  describe('loadCustomMeasurementsSuccess()', () => {
    it('should load custom measurements and trigger the new addition', () => {
      jest.spyOn(CustomMeasurementsStore, 'trigger');

      CustomMeasurementsStore.loadCustomMeasurementsSuccess({
        'measurements.custom.measurement': {functions: ['p99']},
        'measurements.another.custom.measurement': {functions: ['p99']},
      });

      const customMeasurements = CustomMeasurementsStore.getAllCustomMeasurements();
      expect(Object.keys(customMeasurements)).toEqual([
        'measurements.custom.measurement',
        'measurements.another.custom.measurement',
      ]);

      expect(CustomMeasurementsStore.trigger).toHaveBeenCalledTimes(1);
    });
  });
});
