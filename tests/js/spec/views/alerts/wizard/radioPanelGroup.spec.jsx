import {fireEvent, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import RadioGroupPanel from 'app/views/alerts/wizard/radioPanelGroup';

describe('RadioGroupPanel', function () {
  it('calls onChange when clicked', function () {
    const mock = jest.fn();

    mountWithTheme(
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

    fireEvent.click(screen.getByText('Choice Three'));

    expect(mock).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });

  it('Renders extra content', function () {
    const mock = jest.fn();

    mountWithTheme(
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
