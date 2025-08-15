import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import RadioGroupPanel from 'sentry/views/alerts/wizard/radioPanelGroup';

describe('RadioGroupPanel', () => {
  it('calls onChange when clicked', async () => {
    const mock = jest.fn();

    render(
      <RadioGroupPanel
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

    await userEvent.click(screen.getByText('Choice Three'));

    expect(mock).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });

  it('Renders extra content', () => {
    const mock = jest.fn();

    render(
      <RadioGroupPanel
        label="test"
        value="choice_one"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two', 'extra content'],
          ['choice_three', 'Choice Three'],
        ]}
        onChange={mock}
      />
    );
    expect(screen.getByText('extra content')).toBeInTheDocument();
  });
});
