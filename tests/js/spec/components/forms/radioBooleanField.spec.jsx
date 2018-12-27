import React from 'react';
import {shallow} from 'enzyme';

import {RadioBooleanField} from 'app/components/forms';

describe('RadioBooleanField', function() {
  describe('render()', function() {
    it('renders without form context', function() {
      let wrapper = shallow(
        <RadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(
        <RadioBooleanField name="fieldName" yesLabel="Yes" noLabel="No" />,
        {
          context: {
            form: {
              data: {
                fieldName: true,
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
