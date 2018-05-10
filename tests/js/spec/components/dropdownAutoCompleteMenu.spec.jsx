import React from 'react';
import {mount, shallow} from 'enzyme';

import DropdownAutoCompleteMenu from 'app/components/dropdownAutoCompleteMenu';

describe('DropdownAutoCompleteMenu', function() {
  const items = [
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
  ];
  it('renders without a group', function() {
    const wrapper = shallow(
      <DropdownAutoCompleteMenu isOpen={true} items={items}>
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
            value: 'countries',
            label: 'countries',
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

  it('shows empty message when there are no items', function() {
    const wrapper = mount(
      <DropdownAutoCompleteMenu isOpen={true} items={[]} emptyMessage="No items!">
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
    expect(wrapper.find('EmptyMessage').text()).toBe('No items!');

    // Should still be "no items" empty message even if search results return an empty set
    wrapper.find('StyledInput').simulate('change', {target: {value: 'U-S-A'}});
    expect(wrapper.find('EmptyMessage').text()).toBe('No items!');
  });

  it('shows default empty results message when there are no items found in search', function() {
    const wrapper = mount(
      <DropdownAutoCompleteMenu isOpen={true} items={items} emptyMessage="No items!">
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    wrapper.find('StyledInput').simulate('change', {target: {value: 'U-S-A'}});
    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
    expect(wrapper.find('EmptyMessage').text()).toBe('No items! found');
  });

  it('overrides default empty results message', function() {
    const wrapper = mount(
      <DropdownAutoCompleteMenu
        isOpen={true}
        items={items}
        emptyMessage="No items!"
        noResultsMessage="No search results"
      >
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    wrapper.find('StyledInput').simulate('change', {target: {value: 'U-S-A'}});
    expect(wrapper.find('EmptyMessage').text()).toBe('No search results');
  });
});
