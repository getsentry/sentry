import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import {BooleanField} from 'app/components/forms';

describe('BooleanField', function() {
  describe('render()', function() {
    it('renders without form context', function() {
      let wrapper = shallow(<BooleanField name="fieldName" />);
      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(<BooleanField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: true
            },
            errors: {}
          }
        }
      });
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
