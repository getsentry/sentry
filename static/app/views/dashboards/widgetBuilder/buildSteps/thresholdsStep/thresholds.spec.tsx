import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {parseAsThresholds, Thresholds, type ThresholdsConfig} from './thresholds';

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
    const configWithoutMaxValues: ThresholdsConfig = {
      max_values: undefined,
      unit: null,
    };
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

describe('parseAsThresholds', () => {
  it('round trips the config when every key is set', () => {
    const value =
      '{"max_values":{"max1":100,"max2":200.5},"unit":"milliseconds","preferredPolarity":"+","timeWindow":"10m"}';

    const parsed = parseAsThresholds.parse(value);

    expect(parsed).toEqual({
      max_values: {max1: 100, max2: 200.5},
      unit: 'milliseconds',
      preferredPolarity: '+',
      timeWindow: '10m',
    });
    expect(parseAsThresholds.serialize(parsed!)).toBe(value);
  });

  it.each([
    '{"max_values":{},"unit":""}',
    '{"max_values":{"max1":null,"max2":null},"unit":"","preferredPolarity":""}',
    '{"max_values":{"max1":100,"max2":null},"unit":null,"timeWindow":null}',
    '{"max_values":{"max1":100}}',
    '{"unit":"seconds"}',
    '{}',
  ])('keeps the original JSON when optional keys are missing or null: %s', value => {
    const parsed = parseAsThresholds.parse(value);

    expect(parseAsThresholds.serialize(parsed!)).toBe(value);
  });

  it('keeps unknown keys when re-serializing', () => {
    const value = '{"max_values":{"max1":1,"max2":2,"max3":3},"unit":null,"foo":"bar"}';

    const parsed = parseAsThresholds.parse(value);

    expect(parseAsThresholds.serialize(parsed!)).toBe(value);
  });

  it('sets max_values to undefined when it is null', () => {
    const parsed = parseAsThresholds.parse('{"max_values":null,"unit":null}');

    expect(parsed).toEqual({max_values: undefined, unit: null});
  });

  it.each(['"up"', 'null', '1'])('drops preferredPolarity when it is %s', polarity => {
    const parsed = parseAsThresholds.parse(
      `{"max_values":{"max1":100,"max2":200},"preferredPolarity":${polarity}}`
    );

    expect(parsed).toEqual({max_values: {max1: 100, max2: 200}});
  });

  it('converts max values to numbers when they are numeric strings', () => {
    const parsed = parseAsThresholds.parse(
      '{"max_values":{"max1":"100","max2":" 2.5 "}}'
    );

    expect(parsed).toEqual({max_values: {max1: 100, max2: 2.5}});
  });

  it.each([
    '',
    'not json',
    'null',
    '[]',
    '1',
    '"abc"',
    '{"max_values":[1,2]}',
    '{"max_values":"abc"}',
    '{"max_values":{"max1":"abc"}}',
    '{"max_values":{"max1":""}}',
    '{"max_values":{"max1":"  "}}',
    '{"max_values":{"max1":true}}',
    '{"max_values":{"max1":1e999}}',
    '{"unit":5}',
    '{"timeWindow":10}',
  ])('returns null when the value is %s', value => {
    const parsed = parseAsThresholds.parse(value);

    expect(parsed).toBeNull();
  });
});
