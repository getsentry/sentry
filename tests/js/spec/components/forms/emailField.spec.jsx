import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {EmailField} from 'app/components/forms';

describe('EmailField', function() {
  describe('render()', function() {
    it('renders', function() {
      const wrapper = shallow(<EmailField name="fieldName" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with value', function() {
      const wrapper = shallow(<EmailField name="fieldName" value="foo@example.com" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      const wrapper = shallow(<EmailField name="fieldName" />, {
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
