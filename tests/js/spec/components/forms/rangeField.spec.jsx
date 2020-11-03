import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import {RangeField} from 'app/components/forms';

describe('RangeField', function () {
  describe('render()', function () {
    it('renders', function () {
      const wrapper = shallow(<RangeField name="fieldName" />, {
        disableLifecycleMethods: true,
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with optional attributes', function () {
      const wrapper = shallow(
        <RangeField
          name="fieldName"
          min={0}
          max={3}
          step={1}
          snap={false}
          allowedValues={[1, 2, 3]}
        />,
        {disableLifecycleMethods: true}
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with value', function () {
      const wrapper = shallow(<RangeField name="fieldName" value={2} />, {
        disableLifecycleMethods: true,
      });
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function () {
      const wrapper = shallow(<RangeField name="fieldName" />, {
        disableLifecycleMethods: true,
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

    it('renders with value=0 in form context', function () {
      const wrapper = shallow(<RangeField name="fieldName" />, {
        disableLifecycleMethods: true,
        context: {
          form: {
            data: {
              fieldName: 0,
            },
            errors: {},
          },
        },
      });

      expect(wrapper.find('[name="fieldName"]').prop('value')).toBe(0);
    });
  });
});
