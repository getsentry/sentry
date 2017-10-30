import React from 'react';
import {shallow} from 'enzyme';

import {Select2Field} from 'app/components/forms';

describe('Select2Field', function() {
  describe('render()', function() {
    it('renders without form context', function() {
      let wrapper = shallow(<Select2Field choices={[]} name="fieldName" />);
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with form context', function() {
      let wrapper = shallow(<Select2Field choices={[]} name="fieldName" />, {
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

    it('renders with flat choices', function() {
      let wrapper = shallow(<Select2Field choices={['a', 'b', 'c']} name="fieldName" />, {
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

    it('renders with paired choices', function() {
      let wrapper = shallow(
        <Select2Field
          choices={[['a', 'abc'], ['b', 'bcd'], ['c', 'cde']]}
          name="fieldName"
        />,
        {
          context: {
            form: {
              data: {
                fieldName: 'fieldValue',
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
