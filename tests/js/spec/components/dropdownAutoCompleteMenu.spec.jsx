import React from 'react';
import {mount, shallow} from 'enzyme';

import DropdownAutoCompleteMenu from 'app/components/dropdownAutoCompleteMenu';

describe('DropdownAutoCompleteMenu', function() {
  it('renders without a group', function() {
    const wrapper = shallow(
      <DropdownAutoCompleteMenu
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
      </DropdownAutoCompleteMenu>
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with a group', function() {
    const wrapper = shallow(
      <DropdownAutoCompleteMenu
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
      </DropdownAutoCompleteMenu>
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('selects', function() {
    const mock = jest.fn();

    const wrapper = mount(
      <DropdownAutoCompleteMenu
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
      </DropdownAutoCompleteMenu>
    );
    wrapper
      .find('AutoCompleteItem')
      .last()
      .simulate('click');
    expect(mock).toMatchSnapshot();
  });
});
