import React from 'react';
import {mount} from 'enzyme';

import {SelectField} from 'app/components/forms';

describe('SelectField', function() {
  describe('render()', function() {
    it('renders without form context', function() {
      let wrapper = mount(
        <SelectField
          options={[{label: 'a', value: 'a'}, {label: 'b', value: 'b'}]}
          name="fieldName"
          value="a"
        />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = mount(
        <SelectField
          options={[{label: 'a', value: 'a'}, {label: 'b', value: 'b'}]}
          name="fieldName"
        />,
        {
          context: {
            form: {
              data: {
                fieldName: 'a',
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
