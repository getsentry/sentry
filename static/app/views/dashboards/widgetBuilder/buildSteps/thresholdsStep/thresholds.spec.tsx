import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Thresholds, type ThresholdsConfig} from './thresholds';

const exampleThresholdsConfig: ThresholdsConfig = {
  max_values: {
    max1: 100,
    max2: 200,
  },
  unit: null,
};

describe('Widget Builder > ThresholdsStep', () => {
  it('renders without crashing when max_values is undefined', async () => {
    const onChange = jest.fn();
    const configWithoutMaxValues = {
      max_values: undefined,
      unit: null,
    } as unknown as ThresholdsConfig;
    render(
      <Thresholds
        thresholdsConfig={configWithoutMaxValues}
        onThresholdChange={onChange}
        onUnitChange={onChange}
        errors={{}}
      />
    );

    // Component should render with empty max value inputs instead of throwing
    expect(await screen.findByLabelText('First Minimum')).toBeInTheDocument();
    expect(screen.getByLabelText('First Maximum', {selector: 'input'})).toHaveValue(null);
    expect(screen.getByLabelText('Second Maximum', {selector: 'input'})).toHaveValue(
      null
    );
  });

  it('renders thresholds step', async () => {
    const onChange = jest.fn();
    render(
      <Thresholds
        thresholdsConfig={exampleThresholdsConfig}
        onThresholdChange={onChange}
        onUnitChange={onChange}
        errors={{max1: 'error'}}
      />
    );

    // Check minimum value boxes are disabled
    expect(await screen.findByLabelText('First Minimum')).toBeDisabled();
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

  it('passes a selected interval and clears it when Fixed is selected', async () => {
    const onThresholdTimeWindowChange = jest.fn();
    const {rerender} = render(
      <Thresholds
        thresholdsConfig={exampleThresholdsConfig}
        onThresholdChange={jest.fn()}
        onUnitChange={jest.fn()}
        onThresholdTimeWindowChange={onThresholdTimeWindowChange}
        showThresholdTimeWindow
      />
    );

    await userEvent.click(screen.getByText('Fixed'));
    await userEvent.click(screen.getByText('10 minutes'));
    expect(onThresholdTimeWindowChange).toHaveBeenLastCalledWith('10m');

    rerender(
      <Thresholds
        thresholdsConfig={{...exampleThresholdsConfig, timeWindow: '10m'}}
        onThresholdChange={jest.fn()}
        onUnitChange={jest.fn()}
        onThresholdTimeWindowChange={onThresholdTimeWindowChange}
        showThresholdTimeWindow
      />
    );

    await userEvent.click(screen.getByText('10 minutes'));
    await userEvent.click(screen.getByText('Fixed'));
    expect(onThresholdTimeWindowChange).toHaveBeenLastCalledWith(undefined);
  });
});
