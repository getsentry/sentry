import {mountWithTheme} from 'sentry-test/enzyme';

import RadioGroupPanel from 'app/views/alerts/wizard/radioPanelGroup';

describe('RadioGroupPanel', function () {
  it('calls onChange when clicked', function () {
    const mock = jest.fn();

    const wrapper = mountWithTheme(
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
    wrapper.find('[role="radio"] Radio').last().simulate('change');
    expect(mock).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });

  it('Renders extra content', function () {
    const mock = jest.fn();

    const wrapper = mountWithTheme(
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
    expect(wrapper.text().includes('extra content')).toEqual(true);
  });
});
