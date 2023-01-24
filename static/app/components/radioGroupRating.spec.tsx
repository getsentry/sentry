import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  RadioGroupRating,
  RadioGroupRatingProps,
} from 'sentry/components/radioGroupRating';

const options: RadioGroupRatingProps['options'] = {
  0: {
    label: 'Very Dissatisfied',
    description: "Not disappointed (It isn't really useful)",
  },
  1: {
    label: 'Dissatisfied',
  },
  2: {
    label: 'Neutral',
  },
  3: {
    label: 'Satisfied',
  },
  4: {
    description: "Very disappointed (It's a deal breaker)",
    label: 'Very Satisfied',
  },
};

describe('RadioGroupRating', function () {
  it('render numerical labels', function () {
    const handleChange = jest.fn();

    render(
      <RadioGroupRating
        name="feelingIfFeatureNotAvailableRating"
        options={options}
        onChange={handleChange}
        label="How satisfied are you with this feature?"
      />
    );

    expect(
      screen.getByText('How satisfied are you with this feature?')
    ).toBeInTheDocument();

    expect(screen.getAllByRole('radio')).toHaveLength(Object.keys(options).length);

    Object.keys(options).forEach((key, index) => {
      expect(screen.getByText(index + 1)).toBeInTheDocument();
      expect(
        screen.getByLabelText(`Select option ${options[key].label}`)
      ).toBeInTheDocument();

      const description = options[key].description;
      if (description) {
        expect(screen.getByText(description)).toBeInTheDocument();
      }
    });

    // Click on the first option
    userEvent.click(screen.getByLabelText(`Select option ${options[0].label}`));
    expect(handleChange).toHaveBeenCalledWith('0');
  });
});
