import React from 'react';
import {mount, shallow} from 'sentry-test/enzyme';

import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';

describe('RadioGroup', function() {
  it('renders', function() {
    const mock = jest.fn();
    const wrapper = shallow(
      <RadioGroup
        name="radio"
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
    expect(wrapper).toMatchSnapshot();
  });

  it('renders disabled', function() {
    const mock = jest.fn();
    const wrapper = mount(
      <RadioGroup
        name="radio"
        label="test"
        value="choice_one"
        disabled
        choices={[['choice_one', 'Choice One']]}
        onChange={mock}
      />
    );
    expect(wrapper).toMatchSnapshot();

    expect(wrapper.find('RadioLineText').props().disabled).toBe(true);
    expect(wrapper.find('RadioLineButtonFill').props().disabled).toBe(true);
  });

  it('can select a different item', function() {
    const mock = jest.fn();
    const wrapper = shallow(
      <RadioGroup
        name="radio"
        label="test"
        value="choice_three"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
        onChange={mock}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('calls onChange when clicked', function() {
    const mock = jest.fn();

    const wrapper = mount(
      <RadioGroup
        name="radio"
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
    wrapper
      .find('[role="radio"]')
      .last()
      .simulate('click');
    expect(mock).toHaveBeenCalledWith(expect.any(String), expect.any(Object));
  });
});
