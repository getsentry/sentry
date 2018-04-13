import React from 'react';
import {shallow} from 'enzyme';

import {MultiSelectField} from 'app/components/forms';

describe('MultiSelectField', function() {
  describe('render()', function() {
    it('renders without form context', function() {
      let wrapper = shallow(
        <MultiSelectField
          options={[{label: 'a', value: 'a'}, {label: 'b', value: 'b'}]}
          name="fieldName"
        />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(
        <MultiSelectField
          options={[{label: 'a', value: 'a'}, {label: 'b', value: 'b'}]}
          name="fieldName"
        />,
        {
          context: {
            form: {
              data: {
                fieldName: ['a', 'b'],
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
