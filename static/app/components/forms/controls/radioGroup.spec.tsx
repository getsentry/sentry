import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';

describe('RadioGroup', () => {
  it('renders', () => {
    render(
      <RadioGroup
        label="test"
        value="choice_one"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
        onChange={jest.fn()}
      />
    );
  });

  it('renders disabled', () => {
    render(
      <RadioGroup
        label="test"
        value="choice_one"
        disabled
        choices={[['choice_one', 'Choice One']]}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByRole('radio', {name: 'Choice One'})).toBeDisabled();
  });

  it('renders disabled choice', async () => {
    render(
      <RadioGroup
        label="test"
        value="choice_one"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
        ]}
        disabledChoices={[['choice_two', 'Reason why choice two is disabled']]}
        onChange={jest.fn()}
      />
    );

    expect(screen.getByRole('radio', {name: 'Choice One'})).toBeEnabled();
    expect(screen.getByRole('radio', {name: 'Choice Two'})).toBeDisabled();

    await userEvent.hover(screen.getByRole('radio', {name: 'Choice Two'}));
    expect(
      await screen.findByText('Reason why choice two is disabled')
    ).toBeInTheDocument();
  });

  it('can select a different item', () => {
    render(
      <RadioGroup
        label="test"
        value="choice_three"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
        onChange={jest.fn()}
      />
    );
  });

  it('calls onChange when clicked', async () => {
    const mock = jest.fn();

    render(
      <RadioGroup
        label="test"
        value="choice_one"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
        onChange={mock}
      />
    );

    await userEvent.click(screen.getByRole('radio', {name: 'Choice Three'}));
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
