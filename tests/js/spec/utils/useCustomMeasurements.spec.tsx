import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useCustomMeasurements from 'sentry/utils/useCustomMeasurements';

describe('useCustomMeasurements', function () {
  beforeEach(() => {});

  it('provides customMeasurements from the custom measurements store', function () {
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
