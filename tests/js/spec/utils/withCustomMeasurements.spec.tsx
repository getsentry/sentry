import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import CustomMeasurementsStore from 'sentry/stores/customMeasurementsStore';
import {MeasurementCollection} from 'sentry/utils/measurements/measurements';
import withCustomMeasurements from 'sentry/utils/withCustomMeasurements';

describe('withCustomMeasurements HoC', function () {
  beforeEach(() => {
    CustomMeasurementsStore.reset();
  });

  it('works', function () {
    const MyComponent = ({
      other,
      customMeasurements,
    }: {
      customMeasurements: MeasurementCollection;
      other: any;
    }) => {
      return (
        <div>
          <span>{other}</span>
          {customMeasurements &&
            Object.entries(customMeasurements).map(([key, customMeasurement]) => (
              <em key={key}>
                {customMeasurement.key} : {customMeasurement.name}
              </em>
            ))}
        </div>
      );
    };

    const Container = withCustomMeasurements(MyComponent);
    render(<Container other="value" />);

    // Should forward props.
    expect(screen.getByText('value')).toBeInTheDocument();

    act(() => {
      CustomMeasurementsStore.loadCustomMeasurementsSuccess({
        'measurements.custom.measurement': {functions: ['p99']},
      });
    });

    // Should forward prop
    expect(screen.getByText('value')).toBeInTheDocument();

    // displays stored custom measurement
    const renderedCustomMeasurement = screen.getByText(
      'measurements.custom.measurement : measurements.custom.measurement'
    );
    expect(renderedCustomMeasurement).toBeInTheDocument();
  });
});
