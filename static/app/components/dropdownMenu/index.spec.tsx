import {Fragment} from 'react';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DropdownMenu} from 'sentry/components/dropdownMenu';

describe('DropdownMenu', function () {
  it('renders a basic menu', async function () {
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
    await userEvent.click(screen.getByRole('button', {name: 'This is a Menu'}));

    // The menu is open
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

    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Item One'}));
    expect(onAction).toHaveBeenCalled();
  });

  it('renders disabled items', async function () {
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

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));

    const menuItem = screen.getByRole('menuitemradio', {name: 'Item One'});

    // RTL doesn't support toBeDisabled for aria-disabled
    //
    // See: https://github.com/testing-library/jest-dom/issues/144#issuecomment-577235097
    expect(menuItem).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(menuItem);
    expect(onAction).not.toHaveBeenCalled();
  });

  it('can be dismissed', async function () {
    render(
      <Fragment>
        <DropdownMenu items={[{key: 'item1', label: 'Item One'}]} triggerLabel="Menu A" />
        <DropdownMenu items={[{key: 'item2', label: 'Item Two'}]} triggerLabel="Menu B" />
      </Fragment>
    );

    // Can be dismissed by clicking outside
    await userEvent.click(screen.getByRole('button', {name: 'Menu A'}));
    expect(
      await screen.findByRole('menuitemradio', {name: 'Item One'})
    ).toBeInTheDocument();
    await userEvent.click(document.body);
    await waitFor(() => {
      expect(
        screen.queryByRole('menuitemradio', {name: 'Item One'})
      ).not.toBeInTheDocument();
    });

    // Can be dismissed by pressing Escape
    await userEvent.click(screen.getByRole('button', {name: 'Menu A'}));
    expect(
      await screen.findByRole('menuitemradio', {name: 'Item One'})
    ).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(
        screen.queryByRole('menuitemradio', {name: 'Item One'})
      ).not.toBeInTheDocument();
    });

    // When menu A is open, clicking once on menu B's trigger button closes menu A and
    // then opens menu B
    await userEvent.click(screen.getByRole('button', {name: 'Menu A'}));
    expect(screen.getByRole('menuitemradio', {name: 'Item One'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Menu B'}));
    await waitFor(() => {
      expect(
        screen.queryByRole('menuitemradio', {name: 'Item One'})
      ).not.toBeInTheDocument();
    });
    expect(
      await screen.findByRole('menuitemradio', {name: 'Item Two'})
    ).toBeInTheDocument();
  });

  it('renders submenus', async function () {
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

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));

    // Sub item won't be visible until we hover over its parent
    expect(
      screen.queryByRole('menuitemradio', {name: 'Sub Item'})
    ).not.toBeInTheDocument();

    const parentItem = screen.getByRole('menuitemradio', {name: 'Item'});

    expect(parentItem).toHaveAttribute('aria-expanded', 'false');

    await userEvent.hover(parentItem);

    // The sub item is now visibile
    const subItem = screen.getByRole('menuitemradio', {name: 'Sub Item'});
    expect(subItem).toBeInTheDocument();

    // Menu does not close when hovering over it
    await userEvent.unhover(parentItem);
    await userEvent.hover(subItem);
    expect(subItem).toBeInTheDocument();

    // Menu is closed when hovering the other menu item
    await userEvent.unhover(subItem);
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item Two'}));
    expect(subItem).not.toBeInTheDocument();

    // Click the menu item
    await userEvent.hover(parentItem);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    expect(onAction).toHaveBeenCalled();

    // Entire menu system is closed
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Pressing Esc closes the entire menu system
    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    await userEvent.keyboard('{Escape}');
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Clicking outside closes the entire menu system
    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    await userEvent.click(document.body);
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('renders disabled', async function () {
    const onAction = jest.fn();

    render(
      <DropdownMenu
        isDisabled
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

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));

    // Items should not appear
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
  });

  it('closes after clicking link', async function () {
    render(
      <DropdownMenu
        items={[{key: 'item1', label: 'Item One', to: '/test'}]}
        triggerLabel="Menu"
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Item One'}));
    await waitFor(() => {
      expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    });
  });

  it('navigates to link on enter', async function () {
    const onAction = jest.fn();
    const router = RouterFixture();
    render(
      <DropdownMenu
        items={[
          {key: 'item1', label: 'Item One', to: '/test'},
          {key: 'item2', label: 'Item Two', to: '/test2', onAction},
        ]}
        triggerLabel="Menu"
      />,
      {router}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith(
        expect.objectContaining({pathname: '/test2'})
      );
    });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('navigates to link on meta key', async function () {
    const onAction = jest.fn();
    const router = RouterFixture();
    const user = userEvent.setup();

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DropdownMenu
        items={[
          {key: 'item1', label: 'Item One', to: '/test'},
          {key: 'item2', label: 'Item Two', to: '/test2', onAction},
        ]}
        triggerLabel="Menu"
      />,
      {router}
    );

    await user.click(screen.getByRole('button', {name: 'Menu'}));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('[MetaLeft>]'); // Press meta key without releasing
    await user.keyboard('{Enter}');
    await user.keyboard('[/MetaLeft]'); // Release meta key

    expect(onAction).toHaveBeenCalledTimes(1);
    // JSDOM throws an error on navigation to random urls
    expect(errorSpy).toHaveBeenCalledTimes(1);

    errorSpy.mockRestore();
  });
});
