import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {BooleanField} from 'app/components/forms';

describe('BooleanField', function() {
  describe('render()', function() {
    it('renders without form context', function() {
      const wrapper = mountWithTheme(<BooleanField name="fieldName" />);
      expect(wrapper).toSnapshot();
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      const wrapper = mountWithTheme(<BooleanField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: true,
            },
            errors: {},
          },
        },
      });
      expect(wrapper).toSnapshot();
      expect(wrapper).toMatchSnapshot();
    });
  });
});
