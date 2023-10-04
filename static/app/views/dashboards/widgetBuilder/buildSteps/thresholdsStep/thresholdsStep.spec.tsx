import {render, screen} from 'sentry-test/reactTestingLibrary';

import ThresholdsStep, {ThresholdsConfig} from './thresholdsStep';

const exampleThresholdsConfig: ThresholdsConfig = {
  max_values: {
    max1: 100,
    max2: 200,
  },
  unit: null,
};

describe('Widget Builder > ThresholdsStep', function () {
  it('renders thresholds step', function () {
    const onChange = jest.fn();
    render(
      <ThresholdsStep
        thresholdsConfig={exampleThresholdsConfig}
        onThresholdChange={onChange}
        onUnitChange={onChange}
        errors={{max1: 'error'}}
      />
    );

    expect(screen.getByText('Set thresholds')).toBeInTheDocument();

    // Check minimum value boxes are disabled
    expect(screen.getByLabelText('First Minimum')).toBeDisabled();
    expect(screen.getByLabelText('Second Minimum')).toBeDisabled();
    expect(screen.getByLabelText('Third Minimum')).toBeDisabled();

    // Check minimum values
    expect(screen.getByLabelText('First Minimum', {selector: 'input'})).toHaveValue(0);
    expect(screen.getByLabelText('Second Minimum', {selector: 'input'})).toHaveValue(100);
    expect(screen.getByLabelText('Third Minimum', {selector: 'input'})).toHaveValue(200);

    // Check max values
    expect(screen.getByLabelText('First Maximum', {selector: 'input'})).toHaveValue(100);
    expect(screen.getByLabelText('Second Maximum', {selector: 'input'})).toHaveValue(200);
    expect(screen.getByLabelText('Third Maximum', {selector: 'input'})).toHaveAttribute(
      'placeholder',
      'No max'
    );
  });
});
