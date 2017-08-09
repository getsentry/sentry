import React from 'react';
import {shallow} from 'enzyme';

import {NumberField} from 'app/components/forms';

describe('NumberField', function() {
  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(<NumberField name="fieldName" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with optional attributes', function() {
      let wrapper = shallow(<NumberField name="fieldName" min={0} max={100} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with value', function() {
      let wrapper = shallow(<NumberField name="fieldName" value={5} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(<NumberField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 5,
            },
            errors: {},
          },
        },
      });
      expect(wrapper).toMatchSnapshot();
    });
  });
});
