import {Fragment} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

describe('DropdownMenu', () => {
  it('opens interactive submenu content with the keyboard and restores focus', async () => {
    render(
      <DropdownMenu
        triggerLabel="Filter"
        items={[
          {
            key: 'assignee',
            label: 'Assignee',
            submenu: {
              title: 'Choose assignees',
              content: ({close}) => <Button onClick={close}>Apply</Button>,
            },
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Filter'}));
    const submenuTrigger = screen.getByRole('menuitemradio', {name: 'Assignee'});
    expect(submenuTrigger).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', {name: 'Choose assignees'})).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Apply'})).toHaveFocus()
    );

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('menu')).toBeInTheDocument();
    await waitFor(() => expect(submenuTrigger).toHaveFocus());

    await userEvent.keyboard('{ArrowRight}');
    await userEvent.click(screen.getByRole('button', {name: 'Apply'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Filter'})).toHaveFocus()
    );
  });

  it('renders a basic menu', async () => {
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

    const actionItem = screen.getByRole('menuitemradio', {name: 'Item One'});
    expect(actionItem).not.toHaveAttribute('href');

    await userEvent.click(actionItem);
    expect(onAction).toHaveBeenCalled();
  });

  it('renders disabled items', async () => {
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

  it('can be dismissed', async () => {
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

  it('renders submenus', async () => {
    const onAction = jest.fn();
    const onOpenChange = jest.fn();

    render(
      <DropdownMenu
        items={[
          {
            key: 'item1',
            label: 'Item',
            submenu: true,
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
        onOpenChange={onOpenChange}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    expect(onOpenChange).toHaveBeenCalledTimes(1);

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
    const otherItem = screen.getByRole('menuitemradio', {name: 'Item Two'});
    await userEvent.hover(otherItem);
    expect(subItem).not.toBeInTheDocument();
    expect(otherItem).toHaveFocus();

    // Click the menu item
    await userEvent.hover(parentItem);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    expect(onAction).toHaveBeenCalled();

    // Entire menu system is closed
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Pressing Esc closes the entire menu system
    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    expect(onOpenChange).toHaveBeenCalledTimes(3);
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledTimes(4);
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Clicking outside closes the entire menu system
    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    expect(onOpenChange).toHaveBeenCalledTimes(5);
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    await userEvent.click(document.body);
    expect(onOpenChange).toHaveBeenCalledTimes(6);
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it.each(['right', 'left'] as const)(
    'keeps a %s submenu open while crossing a sibling diagonally',
    async side => {
      const user = userEvent.setup();
      render(
        <DropdownMenu
          triggerLabel="Menu"
          items={[
            {
              key: 'parent',
              label: 'Parent',
              submenu: true,
              children: [{key: 'child', label: 'Child'}],
            },
            {key: 'sibling', label: 'Sibling'},
          ]}
        />
      );
      await user.click(screen.getByRole('button', {name: 'Menu'}));
      const parent = screen.getByRole('menuitemradio', {name: 'Parent'});
      const sibling = screen.getByRole('menuitemradio', {name: 'Sibling'});
      const x = side === 'right' ? 80 : 320;
      await user.pointer({target: parent, coords: {clientX: x, clientY: 20}});
      const child = screen.getByRole('menuitemradio', {name: 'Child'});
      const submenu = screen.getAllByRole('menu')[1]!.parentElement!.parentElement!;
      jest
        .spyOn(submenu, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(side === 'right' ? 200 : 0, 0, 200, 240));

      await user.pointer({
        target: sibling,
        coords: {clientX: side === 'right' ? 150 : 250, clientY: 60},
      });
      expect(child).toBeInTheDocument();
      expect(sibling).not.toHaveFocus();

      await user.pointer({
        target: child,
        coords: {clientX: side === 'right' ? 220 : 180, clientY: 70},
      });
      expect(child).toHaveFocus();
      await user.pointer({target: sibling, coords: {clientX: x, clientY: 60}});
      expect(child).not.toBeInTheDocument();
      expect(sibling).toHaveFocus();
    }
  );

  it.each(['away', 'outside', 'timeout', 'click', 'touch'] as const)(
    'releases deferred sibling hover on %s',
    async action => {
      const user = userEvent.setup();
      const onAction = jest.fn();
      render(
        <DropdownMenu
          triggerLabel="Menu"
          items={[
            {
              key: 'parent',
              label: 'Parent',
              submenu: true,
              children: [{key: 'child', label: 'Child'}],
            },
            {key: 'sibling', label: 'Sibling', onAction},
          ]}
        />
      );
      await user.click(screen.getByRole('button', {name: 'Menu'}));
      const parent = screen.getByRole('menuitemradio', {name: 'Parent'});
      const sibling = screen.getByRole('menuitemradio', {name: 'Sibling'});
      await user.pointer({target: parent, coords: {clientX: 80, clientY: 20}});
      const child = screen.getByRole('menuitemradio', {name: 'Child'});
      const submenu = screen.getAllByRole('menu')[1]!.parentElement!.parentElement!;
      jest
        .spyOn(submenu, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(200, 0, 200, 240));
      await user.pointer({
        target: sibling,
        coords: {clientX: action === 'away' ? 70 : 150, clientY: 60},
      });
      if (action === 'away') {
        expect(child).not.toBeInTheDocument();
        expect(sibling).toHaveFocus();
        return;
      }
      expect(child).toBeInTheDocument();
      expect(sibling).not.toHaveFocus();

      if (action === 'outside') {
        await user.pointer({target: sibling, coords: {clientX: 70, clientY: 60}});
        expect(child).not.toBeInTheDocument();
        expect(sibling).toHaveFocus();
      } else if (action === 'click' || action === 'touch') {
        if (action === 'touch') {
          jest
            .spyOn(sibling, 'getBoundingClientRect')
            .mockReturnValue(new DOMRect(0, 40, 200, 40));
          await user.pointer({
            keys: '[TouchA]',
            target: sibling,
            coords: {clientX: 150, clientY: 60},
          });
        } else {
          await user.click(sibling);
        }
        await waitFor(() => expect(onAction).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      } else {
        await waitFor(() => expect(child).not.toBeInTheDocument());
        expect(sibling).toHaveFocus();
      }
    }
  );

  it('opens and closes nested submenus with arrow keys', async () => {
    render(
      <DropdownMenu
        triggerLabel="Menu"
        items={[
          {
            key: 'parent',
            label: 'More actions',
            submenu: true,
            children: [
              {
                key: 'child',
                label: 'Nested actions',
                submenu: true,
                children: [{key: 'leaf', label: 'Run action'}],
              },
            ],
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    const parent = screen.getByRole('menuitemradio', {name: 'More actions'});
    await waitFor(() => expect(parent).toHaveFocus());

    await userEvent.keyboard('{ArrowRight}');
    const child = await screen.findByRole('menuitemradio', {name: 'Nested actions'});
    await waitFor(() => expect(child).toHaveFocus());

    await userEvent.keyboard('{ArrowRight}');
    const leaf = await screen.findByRole('menuitemradio', {name: 'Run action'});
    await waitFor(() => expect(leaf).toHaveFocus());

    await userEvent.keyboard('{ArrowLeft}');
    expect(
      screen.queryByRole('menuitemradio', {name: 'Run action'})
    ).not.toBeInTheDocument();
    await waitFor(() => expect(child).toHaveFocus());

    await userEvent.keyboard('{ArrowLeft}');
    expect(
      screen.queryByRole('menuitemradio', {name: 'Nested actions'})
    ).not.toBeInTheDocument();
    await waitFor(() => expect(parent).toHaveFocus());
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('keeps the root menu open when activating a submenu', async () => {
    const onAction = jest.fn();
    render(
      <DropdownMenu
        triggerLabel="Menu"
        items={[
          {
            key: 'parent',
            label: 'More actions',
            submenu: {title: 'Actions'},
            children: [{key: 'child', label: 'Run action', onAction}],
          },
        ]}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    await waitFor(() =>
      expect(screen.getByRole('menuitemradio', {name: 'More actions'})).toHaveFocus()
    );
    await userEvent.keyboard('{Enter}');

    const child = await screen.findByRole('menuitemradio', {name: 'Run action'});
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('Actions')).toBeInTheDocument();
    await userEvent.click(child);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('renders disabled', async () => {
    const onAction = jest.fn();

    render(
      <DropdownMenu
        isDisabled
        items={[
          {
            key: 'item1',
            label: 'Item',
            submenu: true,
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

  it('closes after clicking link', async () => {
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

  it('closes after clicking external link', async () => {
    const onAction = jest.fn();

    render(
      <DropdownMenu
        items={[
          {
            key: 'item1',
            label: 'Item One',
            externalHref: 'https://example.com',
            onAction,
          },
        ]}
        triggerLabel="Menu"
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Item One'}));
    await waitFor(() => {
      expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('navigates to link on enter', async () => {
    const onAction = jest.fn();
    const {router} = render(
      <DropdownMenu
        items={[
          {key: 'item1', label: 'Item One', to: '/test'},
          {key: 'item2', label: 'Item Two', to: '/test2', onAction},
        ]}
        triggerLabel="Menu"
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(router.location.pathname).toBe('/test2');
    });
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('navigates to link on meta key', async () => {
    const onAction = jest.fn();
    const user = userEvent.setup();

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DropdownMenu
        items={[
          {key: 'item1', label: 'Item One', to: '/test'},
          {key: 'item2', label: 'Item Two', to: '/test2', onAction},
        ]}
        triggerLabel="Menu"
      />
    );

    await user.click(screen.getByRole('button', {name: 'Menu'}));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('[MetaLeft>]'); // Press meta key without releasing
    await user.keyboard('{Enter}');
    await user.keyboard('[/MetaLeft]'); // Release meta key

    expect(onAction).toHaveBeenCalledTimes(1);
    // JSDOM throws an error on navigation to random urls. Jest 30.4.1 may
    // forward the same error twice, so the exact call count is not meaningful.
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('navigates to external link enter', async () => {
    const onAction = jest.fn();
    const user = userEvent.setup();

    render(
      <DropdownMenu
        items={[
          {key: 'item1', label: 'Item One', externalHref: 'https://example.com/foo'},
          {
            key: 'item2',
            label: 'Item Two',
            externalHref: 'https://example.com/bar',
            onAction,
          },
        ]}
        triggerLabel="Menu"
      />
    );

    await user.click(screen.getByRole('button', {name: 'Menu'}));
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('should allow opening of a nearby menu', async () => {
    // render two menus
    render(
      <Fragment>
        <DropdownMenu items={[{key: 'item1', label: 'Item One'}]} triggerLabel="Menu A" />
        <DropdownMenu items={[{key: 'item2', label: 'Item Two'}]} triggerLabel="Menu B" />
      </Fragment>
    );

    // Open menu A
    await userEvent.click(screen.getByRole('button', {name: 'Menu A'}));

    // Open menu B
    await userEvent.click(screen.getByRole('button', {name: 'Menu B'}));

    // Menu B should be open
    const menuB = await screen.findByRole('menuitemradio', {name: 'Item Two'});
    expect(menuB).toBeInTheDocument();
    await waitFor(() => {
      expect(menuB).toHaveFocus();
    });

    // Menu A should be closed
    expect(
      screen.queryByRole('menuitemradio', {name: 'Item One'})
    ).not.toBeInTheDocument();
  });
});
