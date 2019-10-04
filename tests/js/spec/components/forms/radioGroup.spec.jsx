import React from 'react';
import {mount, shallow} from 'enzyme';

import RadioGroup from 'app/views/settings/components/forms/controls/radioGroup';

describe('RadioGroup', function() {
  describe('render()', function() {
    it('renders', function() {
      const wrapper = shallow(
        <RadioGroup
          name="radio"
          value="choice_one"
          choices={[
            ['choice_one', 'Choice One'],
            ['choice_two', 'Choice Two'],
            ['choice_three', 'Choice Three'],
          ]}
        />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('renders disabled', function() {
      const wrapper = mount(
        <RadioGroup
          name="radio"
          value="choice_one"
          disabled
          choices={[['choice_one', 'Choice One']]}
        />
      );
      expect(wrapper).toMatchSnapshot();

      expect(wrapper.find('RadioLineText').props().disabled).toBe(true);
      expect(wrapper.find('RadioLineButtonFill').props().disabled).toBe(true);
    });

    it('can select a different item', function() {
      const wrapper = shallow(
        <RadioGroup
          name="radio"
          value="choice_three"
          choices={[
            ['choice_one', 'Choice One'],
            ['choice_two', 'Choice Two'],
            ['choice_three', 'Choice Three'],
          ]}
        />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('calls onChange when clicked', function() {
      const mock = jest.fn();

      const wrapper = mount(
        <RadioGroup
          name="radio"
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
});
