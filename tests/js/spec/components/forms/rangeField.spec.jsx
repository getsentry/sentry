import React from 'react';
import {shallow} from 'enzyme';

import {RangeField} from 'app/components/forms';

describe('RangeField', function() {
  describe('render()', function() {
    it('renders', function() {
      let wrapper = shallow(<RangeField name="fieldName" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with optional attributes', function() {
      let wrapper = shallow(
        <RangeField
          name="fieldName"
          min={0}
          max={3}
          step={1}
          snap={false}
          allowedValues={[1, 2, 3]}
        />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with value', function() {
      let wrapper = shallow(<RangeField name="fieldName" value={2} />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(<RangeField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 2,
            },
            errors: {},
          },
        },
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with value=0 in form context', function() {
      let wrapper = shallow(<RangeField name="fieldName" />, {
        context: {
          form: {
            data: {
              fieldName: 0,
            },
            errors: {},
          },
        },
      });

      expect(wrapper.find('input').prop('value')).toBe(0);
    });
  });
});
