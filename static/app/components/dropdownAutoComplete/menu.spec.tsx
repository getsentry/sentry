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
    render(
      <DropdownAutoCompleteMenu isOpen items={items}>
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>
    );
  });

  it('renders with a group', function () {
    render(
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
  });

  it('can select an item by clicking', async function () {
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

    await userEvent.click(screen.getByRole('option', {name: 'Australia'}));

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

  it('shows default empty results message when there are no items found in search', async function () {
    render(
      <DropdownAutoCompleteMenu isOpen items={items} emptyMessage="No items!">
        {({selectedItem}) => (selectedItem ? selectedItem.label : 'Click me!')}
      </DropdownAutoCompleteMenu>
    );

    await userEvent.type(screen.getByRole('textbox'), 'U-S-A');

    expect(screen.getByText('No items! found')).toBeInTheDocument();
  });

  it('overrides default empty results message', async function () {
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

    await userEvent.type(screen.getByRole('textbox'), 'U-S-A');

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

  it('filters using a value from prop instead of input', async function () {
    render(
      <DropdownAutoCompleteMenu isOpen items={items} filterValue="Apple">
        {() => 'Click Me!'}
      </DropdownAutoCompleteMenu>
    );

    await userEvent.type(screen.getByRole('textbox'), 'U-S-A');

    expect(screen.getByRole('option', {name: 'Apple'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Corn'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Bacon'})).not.toBeInTheDocument();
  });
});
