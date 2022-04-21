import {mountWithTheme} from 'sentry-test/enzyme';

import DropdownAutoCompleteMenu from 'sentry/components/dropdownAutoComplete/menu';

describe('DropdownAutoCompleteMenu', function () {
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
  it('renders without a group', function () {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu isOpen items={items}>
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>
    );
    expect(wrapper).toSnapshot();
  });

  it('renders with a group', function () {
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
      </DropdownAutoCompleteMenu>
    );
    expect(wrapper).toSnapshot();
  });

  it('selects', function () {
    const mock = jest.fn();
    const countries = [
      {
        value: 'new zealand',
        label: <div>New Zealand</div>,
      },
      {
        value: 'australia',
        label: <div>Australia</div>,
      },
    ];
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu
        isOpen
        items={[
          {
            id: 'countries',
            value: 'countries',
            label: 'countries',
            items: countries,
          },
        ]}
        onSelect={mock}
      >
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    wrapper.find('AutoCompleteItem').last().simulate('click');

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      {index: 1, ...countries[1]},
      {highlightedIndex: 0, inputValue: '', isOpen: true, selectedItem: undefined},
      expect.anything()
    );
  });

  it('shows empty message when there are no items', function () {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu
        items={[]}
        emptyMessage="No items!"
        emptyHidesInput
        isOpen
      >
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
    expect(wrapper.find('EmptyMessage').text()).toBe('No items!');

    // No input because there are no items
    expect(wrapper.find('StyledInput')).toHaveLength(0);
  });

  it('shows default empty results message when there are no items found in search', function () {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu isOpen items={items} emptyMessage="No items!">
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    wrapper.find('StyledInput').simulate('change', {target: {value: 'U-S-A'}});
    expect(wrapper.find('EmptyMessage')).toHaveLength(1);
    expect(wrapper.find('EmptyMessage').text()).toBe('No items! found');
  });

  it('overrides default empty results message', function () {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu
        isOpen
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

  it('hides filter with `hideInput` prop', function () {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu isOpen items={items} hideInput>
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>
    );

    expect(wrapper.find('StyledInput')).toHaveLength(0);
  });

  it('filters using a value from prop instead of input', function () {
    const wrapper = mountWithTheme(
      <DropdownAutoCompleteMenu isOpen items={items} filterValue="Apple">
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>
    );
    wrapper.find('StyledInput').simulate('change', {target: {value: 'U-S-A'}});
    expect(wrapper.find('EmptyMessage')).toHaveLength(0);
    expect(wrapper.find('AutoCompleteItem')).toHaveLength(1);
    expect(wrapper.find('AutoCompleteItem').text()).toBe('Apple');
  });
});
