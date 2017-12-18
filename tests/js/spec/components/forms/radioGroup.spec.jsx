import React from 'react';
import {mount, shallow} from 'enzyme';

import RadioGroup from 'app/views/settings/components/forms/radioGroup';

describe('RadioGroup', function() {
  describe('render()', function() {
    it('renders', function() {
      const wrapper = shallow(
        <RadioGroup
          name="radio"
          value={0}
          choices={[[0, 'Choice One'], [1, 'Choice Two'], [2, 'Choice Three']]}
        />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('can select a different item', function() {
      const wrapper = shallow(
        <RadioGroup
          name="radio"
          value={2}
          choices={[[0, 'Choice One'], [1, 'Choice Two'], [2, 'Choice Three']]}
        />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('calls onChange when clicked', function() {
      const mock = jest.fn();

      const wrapper = mount(
        <RadioGroup
          name="radio"
          value={0}
          choices={[[0, 'Choice One'], [1, 'Choice Two'], [2, 'Choice Three']]}
          onChange={mock}
        />
      );
      wrapper
        .find('[role="radio"]')
        .last()
        .simulate('click');
      expect(mock).toBeCalledWith(expect.any(Number), expect.any(Object));
    });
  });
});
