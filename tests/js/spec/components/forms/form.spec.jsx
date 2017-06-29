import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import {Form} from 'app/components/forms';

describe('Form', function() {
  describe('render()', function() {
    it('renders with children', function() {
      let wrapper = shallow(<Form onSubmit={() => {}}><hr /></Form>);
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
