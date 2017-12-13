import React from 'react';
import {mount, shallow} from 'enzyme';

import Form from 'app/views/settings/components/forms/form';
import RadioField from 'app/views/settings/components/forms/radioField';

describe('RadioField', function() {
  describe('render()', function() {
    it('renders', function() {
      const wrapper = shallow(
        <RadioField
          choices={() => [[0, 'Choice One'], [1, 'Choice Two'], [2, 'Choice Three']]}
        />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it.skip('can select a different item', function() {
      const wrapper = mount(
        <Form>
          <RadioField
            choices={() => [[0, 'Choice One'], [1, 'Choice Two'], [2, 'Choice Three']]}
          />
        </Form>
      );
      wrapper
        .find('[role="radio"]')
        .last()
        .simulate('click');
      expect(wrapper).toMatchSnapshot();
    });
  });
});
