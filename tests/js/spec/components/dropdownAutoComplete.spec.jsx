import React from 'react';
import {mount, shallow} from 'enzyme';

import DropdownAutoComplete from 'app/components/dropdownAutoComplete';

describe('DropdownAutoComplete', function() {
  describe('render()', function() {
    it('renders without a group', function() {
      const wrapper = shallow(
        <DropdownAutoComplete
          isOpen={true}
          items={[
            {
              value: 'apple',
              label: <div>Apple</div>,
            },
            {
              value: 'bacon',
              label: <div>Bacon</div>,
            },
            {
              value: 'corn',
              label: <div>Corn</div>,
            },
          ]}
        >
          {() => 'Click Me!'}
        </DropdownAutoComplete>
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('renders with a group', function() {
      const wrapper = shallow(
        <DropdownAutoComplete
          isOpen={true}
          items={[
            {
              group: {
                value: 'countries',
                label: 'countries',
              },
              items: [
                {
                  value: 'new zealand',
                  label: <div>New Zealand</div>,
                },
                {
                  value: 'australia',
                  label: <div>Australia</div>,
                },
              ],
            },
          ]}
        >
          {() => 'Click Me!'}
        </DropdownAutoComplete>
      );
      expect(wrapper).toMatchSnapshot();
    });

    it('selects', function() {
      const mock = jest.fn();

      const wrapper = mount(
        <DropdownAutoComplete
          isOpen={true}
          items={[
            {
              group: {
                value: 'countries',
                label: 'countries',
              },
              items: [
                {
                  value: 'new zealand',
                  label: <div>New Zealand</div>,
                },
                {
                  value: 'australia',
                  label: <div>Australia</div>,
                },
              ],
            },
          ]}
        >
          {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
        </DropdownAutoComplete>
      );
      wrapper
        .find('[index]')
        .last()
        .simulate('click');
      expect(mock).toMatchSnapshot();
    });
  });
});
