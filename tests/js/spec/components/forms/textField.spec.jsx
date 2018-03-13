import React from 'react';
import {shallow} from 'enzyme';

import {TextField} from 'app/components/forms';

describe('TextField', function() {
  describe('render()', function() {
    it('renders without form context', function() {
      let wrapper = shallow(<TextField name="fieldName" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(<TextField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 'fieldValue',
            },
            errors: {},
          },
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});
