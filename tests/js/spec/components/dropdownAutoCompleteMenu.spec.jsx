import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import DropdownAutoCompleteMenu from 'app/components/dropdownAutoCompleteMenu';

describe('DropdownAutoCompleteMenu', function() {
  const routerContext = TestStubs.routerContext();
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
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu isOpen items={items}>
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>,
      routerContext
    );
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });

  it('renders with a group', function() {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu
        isOpen
        items={[
          {
            id: 'countries',
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
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>,
      routerContext
    );
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });

  it('selects', function() {
    const mock = jest.fn();

    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu
        isOpen
        items={[
          {
            id: 'countries',
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
      </DropdownAutoCompleteMenu>,
      routerContext
    );

    wrapper
      .find('AutoCompleteItem')
      .last()
      .simulate('click');
    expect(mock).toMatchSnapshot();
  });

  it('shows empty message when there are no items', function() {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu
        emptyHidesInput
        isOpen
        items={[]}
        emptyMessage="No items!"
      >
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>,
      routerContext
    );

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
    expect(wrapper.find('EmptyMessage').text()).toBe('No items!');

    // No input because there are no items
    expect(wrapper.find('StyledInput')).toHaveLength(0);
  });

  it('shows default empty results message when there are no items found in search', function() {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu isOpen items={items} emptyMessage="No items!">
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>,
      routerContext
    );

    wrapper.find('StyledInput').simulate('change', {target: {value: 'U-S-A'}});
    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
    expect(wrapper.find('EmptyMessage').text()).toBe('No items! found');
  });

  it('overrides default empty results message', function() {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu
        isOpen
        items={items}
        emptyMessage="No items!"
        noResultsMessage="No search results"
      >
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>,
      routerContext
    );

    wrapper.find('StyledInput').simulate('change', {target: {value: 'U-S-A'}});
    expect(wrapper.find('EmptyMessage').text()).toBe('No search results');
  });

  it('hides filter with `hideInput` prop', function() {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu isOpen items={items} hideInput>
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>,
      routerContext
    );

    expect(wrapper.find('StyledInput')).toHaveLength(0);
  });

  it('filters using a value from prop instead of input', function() {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu isOpen items={items} filterValue="Apple">
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>,
      routerContext
    );
    wrapper.find('StyledInput').simulate('change', {target: {value: 'U-S-A'}});
    expect(wrapper.find('EmptyMessage')).toHaveLength(0);
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(1);
    expect(wrapper.find('AutoCompleteItem').text()).toBe('Apple');
  });
});
