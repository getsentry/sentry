import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DropdownMenu} from 'sentry/components/dropdownMenu';

describe('DropdownMenu', function () {
  it('renders a basic menu', function () {
    const onAction = jest.fn();

    render(
      <DropdownMenu
        items={[
          {
            key: 'item1',
            label: 'Item One',
            details: 'This is the first item',
            onAction,
          },
          {
            key: 'item2',
            label: 'Item Two',
            details: 'Another description here',
          },
        ]}
        triggerLabel="This is a Menu"
      />
    );

    // Open the mneu
    userEvent.click(screen.getByRole('button', {name: 'This is a Menu'}));

    // The mneu is open
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // There are two menu items
    //
    // TODO(epurkhiser): These should really be menuitem roles NOT
    // menuitemradio's. But react-aria is setting this for us (probably because
    // the menu has submenus, so we need to be able to "select" them). We
    // should figure out how to tell it that this menu does not allow
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);

    expect(
      screen.getByRole('menuitemradio', {name: 'Item One'})
    ).toHaveAccessibleDescription('This is the first item');

    expect(
      screen.getByRole('menuitemradio', {name: 'Item Two'})
    ).toHaveAccessibleDescription('Another description here');

    userEvent.click(screen.getByRole('menuitemradio', {name: 'Item One'}));
    expect(onAction).toHaveBeenCalled();
  });

  it('renders disabled items', function () {
    const onAction = jest.fn();

    render(
      <DropdownMenu
        items={[
          {
            key: 'item1',
            label: 'Item One',
            disabled: true,
            onAction,
          },
        ]}
        triggerLabel="Menu"
      />
    );

    userEvent.click(screen.getByRole('button', {name: 'Menu'}));

    const menuItem = screen.getByRole('menuitemradio', {name: 'Item One'});

    // RTL doesn't support toBeDisabled for aria-disabled
    //
    // See: https://github.com/testing-library/jest-dom/issues/144#issuecomment-577235097
    expect(menuItem).toHaveAttribute('aria-disabled', 'true');

    userEvent.click(menuItem);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('renders submenus', function () {
    const onAction = jest.fn();

    render(
      <DropdownMenu
        items={[
          {
            key: 'item1',
            label: 'Item',
            isSubmenu: true,
            children: [
              {
                key: 'subitem',
                label: 'Sub Item',
                onAction,
              },
            ],
          },
          {
            key: 'item2',
            label: 'Item Two',
          },
        ]}
        triggerLabel="Menu"
      />
    );

    userEvent.click(screen.getByRole('button', {name: 'Menu'}));

    // Sub item won't be visible until we hover over it's parent
    expect(
      screen.queryByRole('menuitemradio', {name: 'Sub Item'})
    ).not.toBeInTheDocument();

    const parentItem = screen.getByRole('menuitemradio', {name: 'Item'});

    expect(parentItem).toHaveAttribute('aria-haspopup', 'true');
    expect(parentItem).toHaveAttribute('aria-expanded', 'false');

    userEvent.hover(parentItem);

    // The sub item is now visibile
    const subItem = screen.getByRole('menuitemradio', {name: 'Sub Item'});
    expect(subItem).toBeInTheDocument();

    // Menu does not close when hovering over it
    userEvent.unhover(parentItem);
    userEvent.hover(subItem);
    expect(subItem).toBeInTheDocument();

    // Menu is closed when hovering the other menu item
    userEvent.unhover(subItem);
    userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item Two'}));
    expect(subItem).not.toBeInTheDocument();

    // Click the menu item
    userEvent.hover(parentItem);
    userEvent.click(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    expect(onAction).toHaveBeenCalled();

    // Entire menu system is closed
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Pressing Esc closes the entire menu system
    userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item'}));
    userEvent.hover(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    userEvent.keyboard('{Esc}');
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Clicking outside closes the entire menu system
    userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item'}));
    userEvent.hover(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    userEvent.click(document.body);
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });
});
