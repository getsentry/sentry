import React from 'react';
import {shallow} from 'enzyme';
import toJson from 'enzyme-to-json';

import {NumberField} from 'app/components/forms';

describe('NumberField', function() {
  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(<NumberField name="fieldName" />);
      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('renders with optional attributes', function() {
      let wrapper = shallow(<NumberField name="fieldName" min={0} max={100} />);
      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('renders with value', function() {
      let wrapper = shallow(<NumberField name="fieldName" value={5} />);
      expect(toJson(wrapper)).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(<NumberField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 5
            },
            errors: {}
          }
        }
      });
      expect(toJson(wrapper)).toMatchSnapshot();
    });
  });
});
