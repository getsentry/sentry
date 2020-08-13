import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import {TextField} from 'app/components/forms';

describe('TextField', function() {
  describe('render()', function() {
    it('renders without form context', function() {
      const wrapper = mountWithTheme(<TextField name="fieldName" />);
      expect(wrapper).toSnapshot();
    });

    it('renders with form context', function() {
      const wrapper = mountWithTheme(<TextField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 'fieldValue',
            },
            errors: {},
          },
        },
      });
      expect(wrapper).toSnapshot();
    });
  });
});
