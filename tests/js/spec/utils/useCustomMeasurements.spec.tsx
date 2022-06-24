import {reactHooks} from 'sentry-test/reactTestingLibrary';

import CustomMeasurementsStore from 'sentry/stores/customMeasurementsStore';
import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';

describe('useCustomMeasurements', function () {
  beforeEach(() => {
    CustomMeasurementsStore.reset();
  });

  it('provides customMeasurements from the custom measurements store', function () {
    reactHooks.act(
      () =>
        void CustomMeasurementsStore.loadCustomMeasurementsSuccess({
          'measurements.custom.measurement': {functions: ['p99']},
          'measurements.another.custom.measurement': {functions: ['p99']},
        })
    );

    const {result} = reactHooks.renderHook(() => useCustomMeasurements());
    const {customMeasurements} = result.current;

    const expected = {
      'measurements.another.custom.measurement': {
        key: 'measurements.another.custom.measurement',
        name: 'measurements.another.custom.measurement',
      },
      'measurements.custom.measurement': {
        key: 'measurements.custom.measurement',
        name: 'measurements.custom.measurement',
      },
    };

    expect(customMeasurements).toEqual(expected);
  });
});
