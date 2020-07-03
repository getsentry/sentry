import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {PasswordField} from 'app/components/forms';

describe('PasswordField', function() {
  describe('render()', function() {
    it('renders', function() {
      const wrapper = shallow(<PasswordField name="fieldName" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with value', function() {
      const wrapper = shallow(<PasswordField name="fieldName" value="foobar" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      const wrapper = shallow(<PasswordField name="fieldName" />, {
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
