import React from 'react';
import {shallow} from 'enzyme';

import {PasswordField} from 'app/components/forms';

describe('PasswordField', function() {
  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(<PasswordField name="fieldName" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with value', function() {
      let wrapper = shallow(<PasswordField name="fieldName" value="foobar" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(<PasswordField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 'foobar',
            },
            errors: {},
          },
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});
