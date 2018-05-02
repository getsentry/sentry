import React from 'react';
import {shallow} from 'enzyme';

import {EmailField} from 'app/components/forms';

describe('EmailField', function() {
  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(<EmailField name="fieldName" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with value', function() {
      let wrapper = shallow(<EmailField name="fieldName" value="foo@example.com" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(<EmailField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 'foo@example.com',
            },
            errors: {},
          },
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});
