import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';

describe('RadioGroup', function () {
  it('renders', function () {
    const {container} = render(
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
    expect(container).toSnapshot();
  });

  it('renders disabled', function () {
    const {container} = render(
      <RadioGroup
        label="test"
        value="choice_one"
        disabled
        choices={[['choice_one', 'Choice One']]}
        onChange={jest.fn()}
      />
    );
    expect(container).toSnapshot();

    expect(screen.getByRole('radio', {name: 'Choice One'})).toBeDisabled();
  });

  it('renders disabled choice', async function () {
    const {container} = render(
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

    expect(container).toSnapshot();

    expect(screen.getByRole('radio', {name: 'Choice One'})).toBeEnabled();
    expect(screen.getByRole('radio', {name: 'Choice Two'})).toBeDisabled();

    userEvent.hover(screen.getByRole('radio', {name: 'Choice Two'}));
    expect(
      await screen.findByText('Reason why choice two is disabled')
    ).toBeInTheDocument();
  });

  it('can select a different item', function () {
    const {container} = render(
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
    expect(container).toSnapshot();
  });

  it('calls onChange when clicked', function () {
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

    userEvent.click(screen.getByRole('radio', {name: 'Choice Three'}));
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
