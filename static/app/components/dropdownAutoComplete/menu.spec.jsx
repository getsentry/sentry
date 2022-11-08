import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
    const {container} = render(
      <DropdownAutoCompleteMenu isOpen items={items}>
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>
    );
    expect(container).toSnapshot();
  });

  it('renders with a group', function () {
    const {container} = render(
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
    expect(container).toSnapshot();
  });

  it('can select an item by clicking', function () {
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
    render(
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

    userEvent.click(screen.getByRole('option', {name: 'Australia'}));

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      {index: 1, ...countries[1]},
      {highlightedIndex: 1, inputValue: '', isOpen: true, selectedItem: undefined},
      expect.anything()
    );
  });

  it('shows empty message when there are no items', function () {
    render(
      <DropdownAutoCompleteMenu
        items={[]}
        emptyMessage="No items!"
        emptyHidesInput
        isOpen
      >
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    expect(screen.getByText('No items!')).toBeInTheDocument();

    // No input because there are no items
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('shows default empty results message when there are no items found in search', function () {
    render(
      <DropdownAutoCompleteMenu isOpen items={items} emptyMessage="No items!">
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    userEvent.type(screen.getByRole('textbox'), 'U-S-A');

    expect(screen.getByText('No items! found')).toBeInTheDocument();
  });

  it('overrides default empty results message', function () {
    render(
      <DropdownAutoCompleteMenu
        isOpen
        items={items}
        emptyMessage="No items!"
        noResultsMessage="No search results"
      >
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    userEvent.type(screen.getByRole('textbox'), 'U-S-A');

    expect(screen.getByText('No search results')).toBeInTheDocument();
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
  });

  it('hides filter with `hideInput` prop', function () {
    render(
      <DropdownAutoCompleteMenu isOpen items={items} hideInput>
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>
    );

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('filters using a value from prop instead of input', function () {
    render(
      <DropdownAutoCompleteMenu isOpen items={items} filterValue="Apple">
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>
    );

    userEvent.type(screen.getByRole('textbox'), 'U-S-A');

    expect(screen.getByRole('option', {name: 'Apple'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Corn'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Bacon'})).not.toBeInTheDocument();
  });
});
