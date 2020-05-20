import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {MultipleCheckboxField} from 'app/components/forms';

describe('MultipleCheckboxField', function() {
  describe('render()', function() {
    it('renders without form context', function() {
      const wrapper = shallow(
        <MultipleCheckboxField
          name="fieldName"
          choices={[
            ['1', 'On'],
            ['2', 'Off'],
          ]}
          value={['1']}
        />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      const wrapper = shallow(
        <MultipleCheckboxField
          name="fieldName"
          choices={[
            ['1', 'On'],
            ['2', 'Off'],
          ]}
        />,
        {
          context: {
            form: {
              data: {
                fieldName: ['1'],
              },
              errors: {},
            },
          },
        }
      );
      expect(wrapper).toMatchSnapshot();
    });
  });
});
