import {Fragment} from 'react';
import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {IconStar} from '@sentry/icons/star';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {lightTheme} from '@sentry/scraps/theme';

describe('DropdownMenu', () => {
  it('filters a searchable root menu', async () => {
    render(
      <DropdownMenu
        triggerLabel="Projects"
        search={{placeholder: 'Search projects'}}
        items={[
          {key: 'javascript', label: 'javascript'},
          {key: 'python', label: 'python'},
        ]}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Projects'}));
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search projects'}),
      'python'
    );

    expect(screen.getByRole('menuitemradio', {name: 'python'})).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'javascript'})
    ).not.toBeInTheDocument();
  });

  it('keeps presses on a trailing action from selecting its menu item', async () => {
    const originalPointerEvent = window.PointerEvent;
    Object.defineProperty(window, 'PointerEvent', {
      configurable: true,
      value: MouseEvent,
    });
    const onAction = jest.fn();
    const onTrailingClick = jest.fn();
    try {
      render(
        <DropdownMenu
          triggerLabel="Projects"
          items={[
            {
              key: 'project',
              label: 'Project',
              onAction,
              trailingAction: {
                icon: <IconStar />,
                label: 'Bookmark',
                onAction: onTrailingClick,
              },
            },
          ]}
        />,
        {wrapper: ThemeWrapper}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Projects'}));
      await userEvent.click(screen.getByRole('button', {name: 'Bookmark'}));

      expect(onTrailingClick).toHaveBeenCalledTimes(1);
      expect(onAction).not.toHaveBeenCalled();
      expect(screen.getByRole('menuitemradio', {name: 'Project'})).toBeInTheDocument();

      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Project'}));
      expect(onAction).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(window, 'PointerEvent', {
        configurable: true,
        value: originalPointerEvent,
      });
    }
  });

  it('keeps keyboard activation of a trailing action from selecting its menu item', async () => {
    const onAction = jest.fn();
    const onTrailingClick = jest.fn();

    render(
      <DropdownMenu
        triggerLabel="Projects"
        items={[
          {
            key: 'project',
            label: 'Project',
            onAction,
            trailingAction: {
              icon: <IconStar />,
              label: 'Bookmark',
              onAction: onTrailingClick,
            },
          },
        ]}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Projects'}));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', {name: 'Bookmark'})).toHaveFocus();
    await userEvent.keyboard('{Enter}');

    expect(onTrailingClick).toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitemradio', {name: 'Project'})).toBeInTheDocument();
  });

  it('moves keyboard focus between a menu item and its trailing action', async () => {
    const onAction = jest.fn();
    const onTrailingClick = jest.fn();

    render(
      <DropdownMenu
        triggerLabel="Projects"
        items={[
          {
            key: 'project',
            label: 'Project',
            onAction,
            trailingAction: {
              icon: <IconStar />,
              label: 'Bookmark',
              onAction: onTrailingClick,
            },
          },
        ]}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Projects'}));
    const row = screen.getByRole('menuitemradio', {name: 'Project'});
    const bookmark = screen.getByRole('button', {name: 'Bookmark'});
    expect(row).toHaveFocus();

    await userEvent.keyboard('{ArrowRight}');
    expect(bookmark).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onTrailingClick).toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();

    await userEvent.keyboard('{ArrowLeft}');
    expect(row).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it.each(['click', '{Enter}', ' '])(
    'opens the menu with %s without activating the row',
    async activation => {
      const onRowClick = jest.fn();

      render(
        <div onClick={onRowClick}>
          <DropdownMenu
            items={[{key: 'duplicate', label: 'Duplicate query'}]}
            triggerLabel="Query actions"
          />
        </div>,
        {wrapper: ThemeWrapper}
      );

      const trigger = screen.getByRole('button', {name: 'Query actions'});
      if (activation === 'click') {
        await userEvent.click(trigger);
      } else {
        trigger.focus();
        await userEvent.keyboard(activation);
      }

      expect(await screen.findByRole('menu')).toBeInTheDocument();
      expect(onRowClick).not.toHaveBeenCalled();
    }
  );

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
      />,
      {wrapper: ThemeWrapper}
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
      />,
      {wrapper: ThemeWrapper}
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
      </Fragment>,
      {wrapper: ThemeWrapper}
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
      />,
      {wrapper: ThemeWrapper}
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

    // ArrowLeft closes the submenu and returns focus to its parent item.
    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    expect(onOpenChange).toHaveBeenCalledTimes(3);
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    await userEvent.keyboard('{ArrowLeft}');
    expect(onOpenChange).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(
      screen.queryByRole('menuitemradio', {name: 'Sub Item'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Item'})).toHaveFocus();

    // Clicking outside closes the entire menu system
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Item'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'Sub Item'}));
    await userEvent.click(document.body);
    expect(onOpenChange).toHaveBeenCalledTimes(4);
    expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('filters a searchable submenu and focuses its search field', async () => {
    const onAction = jest.fn();
    render(
      <DropdownMenu
        triggerLabel="Projects"
        items={[
          {
            key: 'all-projects',
            label: 'All Projects',
            submenu: {
              title: 'All Projects',
              emptyMessage: 'No projects found',
              search: {placeholder: 'Search projects'},
              maxHeight: 240,
            },
            children: [
              {
                key: 'my-projects',
                label: 'My Projects',
                children: [
                  {key: 'javascript', label: 'javascript'},
                  {key: 'sentry', label: 'sentry', onAction},
                ],
              },
            ],
          },
        ]}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Projects'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'All Projects'}));

    const search = screen.getByRole('textbox', {name: 'Search projects'});
    expect(search).toHaveFocus();
    expect(screen.getByRole('menuitemradio', {name: 'javascript'})).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitemradio', {name: 'sentry'})).toHaveFocus();
    const menu = screen.getAllByRole('menu').at(-1)!;
    menu.scrollTop = 100;
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', {name: 'javascript'})).toHaveFocus();
    expect(menu.scrollTop).toBe(0);
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', {name: 'sentry'})).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitemradio', {name: 'javascript'})).toHaveFocus();
    menu.scrollTop = 100;
    await userEvent.keyboard('{ArrowUp}');
    expect(search).toHaveFocus();
    expect(menu.scrollTop).toBe(0);

    await userEvent.type(search, 'dino');
    expect(screen.getByText('No projects found')).toBeInTheDocument();
    await userEvent.clear(search);
    await userEvent.type(search, 'sentry');
    expect(screen.queryByText('No projects found')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: 'javascript'})
    ).not.toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', {name: 'sentry'})).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(search).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', {name: 'sentry'})).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('returns from the first enabled item to search when a disabled item comes first', async () => {
    render(
      <DropdownMenu
        triggerLabel="Projects"
        items={[
          {
            key: 'all-projects',
            label: 'All Projects',
            submenu: {search: {placeholder: 'Search projects'}},
            children: [
              {key: 'archived', label: 'archived', disabled: true},
              {key: 'javascript', label: 'javascript'},
              {key: 'sentry', label: 'sentry'},
            ],
          },
        ]}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Projects'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'All Projects'}));
    const search = screen.getByRole('textbox', {name: 'Search projects'});
    expect(search).toHaveFocus();

    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemradio', {name: 'javascript'})).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(search).toHaveFocus();
  });

  it('preserves cursor navigation and clears a searchable submenu after Escape', async () => {
    render(
      <DropdownMenu
        triggerLabel="Projects"
        items={[
          {
            key: 'all-projects',
            label: 'All Projects',
            submenu: {search: {placeholder: 'Search projects'}},
            children: [
              {key: 'javascript', label: 'javascript'},
              {key: 'sentry', label: 'sentry'},
            ],
          },
        ]}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Projects'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'All Projects'}));
    const search = screen.getByRole<HTMLInputElement>('textbox', {
      name: 'Search projects',
    });
    await userEvent.type(search, 'sentry');
    expect(
      screen.queryByRole('menuitemradio', {name: 'javascript'})
    ).not.toBeInTheDocument();

    await userEvent.keyboard('{ArrowLeft}');
    expect(search).toHaveFocus();
    expect(search.selectionStart).toBe(5);
    expect(search.selectionEnd).toBe(5);
    expect(screen.getByRole('menuitemradio', {name: 'sentry'})).toBeInTheDocument();

    await userEvent.keyboard('{Home}{ArrowLeft}');
    expect(search).toHaveFocus();
    expect(search.selectionStart).toBe(0);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('menuitemradio', {name: 'All Projects'})).toHaveFocus()
    );
    expect(screen.getByRole('button', {name: 'Projects'})).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'All Projects'}));

    expect(screen.getByRole('textbox', {name: 'Search projects'})).toHaveValue('');
    expect(screen.getByRole('menuitemradio', {name: 'javascript'})).toBeInTheDocument();
  });

  it('lets Escape cancel IME composition before dismissing a submenu', async () => {
    render(
      <DropdownMenu
        triggerLabel="Projects"
        items={[
          {
            key: 'all-projects',
            label: 'All Projects',
            submenu: {search: {placeholder: 'Search projects'}},
            children: [{key: 'javascript', label: 'javascript'}],
          },
        ]}
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Projects'}));
    await userEvent.hover(screen.getByRole('menuitemradio', {name: 'All Projects'}));
    const search = screen.getByRole('textbox', {name: 'Search projects'});
    await userEvent.type(search, 'java');

    const escape = new KeyboardEvent('keydown', {
      key: 'Escape',
      isComposing: true,
      bubbles: true,
      cancelable: true,
    });
    search.dispatchEvent(escape);

    expect(escape.defaultPrevented).toBe(false);
    expect(search).toHaveFocus();
    expect(search).toHaveValue('java');
    expect(screen.getByRole('menuitemradio', {name: 'javascript'})).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('menuitemradio', {name: 'All Projects'})).toHaveFocus()
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
        />,
        {wrapper: ThemeWrapper}
      );
      await user.click(screen.getByRole('button', {name: 'Menu'}));
      const parent = screen.getByRole('menuitemradio', {name: 'Parent'});
      const sibling = screen.getByRole('menuitemradio', {name: 'Sibling'});
      const x = side === 'right' ? 80 : 320;
      await user.pointer({target: parent, coords: {clientX: x, clientY: 20}});
      const child = screen.getByRole('menuitemradio', {name: 'Child'});
      // Geometry belongs to the floating position wrapper around the submenu.
      // oxlint-disable-next-line testing-library/no-node-access
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
        />,
        {wrapper: ThemeWrapper}
      );
      await user.click(screen.getByRole('button', {name: 'Menu'}));
      const parent = screen.getByRole('menuitemradio', {name: 'Parent'});
      const sibling = screen.getByRole('menuitemradio', {name: 'Sibling'});
      await user.pointer({target: parent, coords: {clientX: 80, clientY: 20}});
      const child = screen.getByRole('menuitemradio', {name: 'Child'});
      // Geometry belongs to the floating position wrapper around the submenu.
      // oxlint-disable-next-line testing-library/no-node-access
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

  it.each(['Escape', 'ArrowLeft'])(
    'closes nested submenus one level at a time with %s',
    async key => {
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
        />,
        {wrapper: ThemeWrapper}
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

      await userEvent.keyboard(`{${key}}`);
      expect(
        screen.queryByRole('menuitemradio', {name: 'Run action'})
      ).not.toBeInTheDocument();
      await waitFor(() => expect(child).toHaveFocus());
      expect(parent).toHaveAttribute('aria-expanded', 'true');

      await userEvent.keyboard('{ArrowRight}');
      await waitFor(() =>
        expect(screen.getByRole('menuitemradio', {name: 'Run action'})).toHaveFocus()
      );

      await userEvent.keyboard(`{${key}}`);
      expect(
        screen.queryByRole('menuitemradio', {name: 'Run action'})
      ).not.toBeInTheDocument();
      await waitFor(() => expect(child).toHaveFocus());

      await userEvent.keyboard(`{${key}}`);
      expect(
        screen.queryByRole('menuitemradio', {name: 'Nested actions'})
      ).not.toBeInTheDocument();
      await waitFor(() => expect(parent).toHaveFocus());
      expect(screen.getByRole('button', {name: 'Menu'})).toHaveAttribute(
        'aria-expanded',
        'true'
      );
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      await waitFor(() =>
        expect(screen.getByRole('button', {name: 'Menu'})).toHaveFocus()
      );
    }
  );

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
      />,
      {wrapper: ThemeWrapper}
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
      />,
      {wrapper: ThemeWrapper}
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
      />,
      {wrapper: ThemeWrapper}
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
      />,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Item One'}));
    await waitFor(() => {
      expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
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
      />,
      {wrapper: ThemeWrapper}
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
      />,
      {wrapper: ThemeWrapper}
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
      </Fragment>,
      {wrapper: ThemeWrapper}
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

  describe('virtualization', () => {
    // jsdom does not lay out or scroll. Give elements a height so the menu has a
    // viewport and room to scroll, and make scrollTo move the scroll position
    // like a browser does.
    const stubs: Array<[typeof Element.prototype, string, PropertyDescriptor]> = [
      [HTMLElement.prototype, 'offsetHeight', {get: () => 100}],
      [Element.prototype, 'clientHeight', {get: () => 100}],
      [Element.prototype, 'scrollHeight', {get: () => 50_000}],
      [
        Element.prototype,
        'scrollTo',
        {
          value(this: Element, options?: ScrollToOptions) {
            this.scrollTop = options?.top ?? this.scrollTop;
            this.dispatchEvent(new Event('scroll'));
          },
        },
      ],
    ];
    const originals = stubs.map(
      ([target, name]) =>
        [target, name, Object.getOwnPropertyDescriptor(target, name)] as const
    );

    beforeEach(() => {
      for (const [target, name, descriptor] of stubs) {
        Object.defineProperty(target, name, {configurable: true, ...descriptor});
      }
    });

    afterEach(() => {
      for (const [target, name, descriptor] of originals) {
        if (descriptor) {
          Object.defineProperty(target, name, descriptor);
        } else {
          Reflect.deleteProperty(target, name);
        }
      }
    });

    const manyItems = Array.from({length: 500}, (_, index) => ({
      key: `item-${index}`,
      label: `Item ${index}`,
    }));

    function scrollMenuTo(top: number) {
      const menu = screen.getByRole('menu');
      menu.scrollTop = top;
      fireEvent.scroll(menu);
    }

    it('renders only the items near the viewport in a long menu', async () => {
      render(<DropdownMenu triggerLabel="Menu" items={manyItems} />, {
        wrapper: ThemeWrapper,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));

      const rendered = screen.getAllByRole('menuitemradio');
      expect(rendered.length).toBeGreaterThan(0);
      expect(rendered.length).toBeLessThan(manyItems.length);
      expect(screen.getByRole('menuitemradio', {name: 'Item 0'})).toBeInTheDocument();
    });

    it('reaches items outside the window with the keyboard', async () => {
      render(<DropdownMenu triggerLabel="Menu" items={manyItems} />, {
        wrapper: ThemeWrapper,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
      await waitFor(() =>
        expect(screen.getByRole('menuitemradio', {name: 'Item 0'})).toHaveFocus()
      );
      expect(
        screen.queryByRole('menuitemradio', {name: 'Item 499'})
      ).not.toBeInTheDocument();

      await userEvent.keyboard('{End}');

      await waitFor(() =>
        expect(screen.getByRole('menuitemradio', {name: 'Item 499'})).toHaveFocus()
      );
    });

    it('returns to search from the first item after scrolling away', async () => {
      render(
        <DropdownMenu
          triggerLabel="Menu"
          search={{placeholder: 'Search items'}}
          items={manyItems}
        />,
        {wrapper: ThemeWrapper}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
      const search = screen.getByRole('textbox', {name: 'Search items'});
      await waitFor(() => expect(search).toHaveFocus());

      scrollMenuTo(20_000);
      await waitFor(() =>
        expect(
          screen.queryByRole('menuitemradio', {name: 'Item 0'})
        ).not.toBeInTheDocument()
      );

      // Item 0 is not mounted, so ArrowDown scrolls it into view before
      // focusing it.
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(screen.getByRole('menuitemradio', {name: 'Item 0'})).toHaveFocus()
      );
      await userEvent.keyboard('{ArrowUp}');
      expect(search).toHaveFocus();
    });

    it('keeps keyboard focus on an item scrolled out of view', async () => {
      render(<DropdownMenu triggerLabel="Menu" items={manyItems} />, {
        wrapper: ThemeWrapper,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
      await waitFor(() =>
        expect(screen.getByRole('menuitemradio', {name: 'Item 0'})).toHaveFocus()
      );
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByRole('menuitemradio', {name: 'Item 1'})).toHaveFocus();
      // Let the virtualizer settle its scroll to Item 1 before scrolling away.
      await act(() => new Promise(resolve => requestAnimationFrame(resolve)));

      scrollMenuTo(10_000);
      await waitFor(() =>
        expect(
          screen.queryByRole('menuitemradio', {name: 'Item 2'})
        ).not.toBeInTheDocument()
      );

      // The focused item stays mounted, so focus stays in the menu and the
      // keyboard keeps working.
      expect(screen.getByRole('menuitemradio', {name: 'Item 1'})).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(screen.getByRole('menuitemradio', {name: 'Item 2'})).toHaveFocus()
      );
    });

    it('renders every item when the menu is under the threshold', async () => {
      render(
        <DropdownMenu
          triggerLabel="Menu"
          virtualizeThreshold={manyItems.length}
          items={manyItems}
        />,
        {wrapper: ThemeWrapper}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));

      expect(screen.getAllByRole('menuitemradio')).toHaveLength(manyItems.length);
    });

    it('applies the parent menu threshold to submenus', async () => {
      render(
        <DropdownMenu
          triggerLabel="Menu"
          virtualizeThreshold={manyItems.length}
          items={[{key: 'more', label: 'More', submenu: true, children: manyItems}]}
        />,
        {wrapper: ThemeWrapper}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
      await userEvent.hover(screen.getByRole('menuitemradio', {name: 'More'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Item 499'})
      ).toBeInTheDocument();
      expect(screen.getAllByRole('menuitemradio')).toHaveLength(manyItems.length + 1);
    });

    const sectionedItems = ['A', 'B'].map(section => ({
      key: `section-${section}`,
      label: `Section ${section}`,
      children: Array.from({length: 250}, (_, index) => ({
        key: `${section}-${index}`,
        label: `${section} ${index}`,
      })),
    }));

    it('renders only the items near the viewport in a menu with sections', async () => {
      render(<DropdownMenu triggerLabel="Menu" items={sectionedItems} />, {
        wrapper: ThemeWrapper,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));

      const sectionA = screen.getByRole('group', {name: 'Section A'});
      expect(
        within(sectionA).getByRole('menuitemradio', {name: 'A 0'})
      ).toBeInTheDocument();
      expect(screen.getAllByRole('menuitemradio').length).toBeLessThan(500);
      expect(screen.queryByRole('group', {name: 'Section B'})).not.toBeInTheDocument();
    });

    it('reaches items in a later section with the keyboard', async () => {
      render(<DropdownMenu triggerLabel="Menu" items={sectionedItems} />, {
        wrapper: ThemeWrapper,
      });

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
      await waitFor(() =>
        expect(screen.getByRole('menuitemradio', {name: 'A 0'})).toHaveFocus()
      );

      await userEvent.keyboard('{End}');

      await waitFor(() =>
        expect(screen.getByRole('menuitemradio', {name: 'B 249'})).toHaveFocus()
      );
      // The item renders inside its section, which keeps its heading.
      expect(
        within(screen.getByRole('group', {name: 'Section B'})).getByRole(
          'menuitemradio',
          {name: 'B 249'}
        )
      ).toBeInTheDocument();
    });

    it('keeps the item with the longest label mounted, so the menu does not widen while scrolling', async () => {
      const items = manyItems.map(item =>
        item.key === 'item-400'
          ? {...item, label: 'A much longer label than the rest'}
          : item
      );
      render(<DropdownMenu triggerLabel="Menu" items={items} />, {wrapper: ThemeWrapper});

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));

      expect(
        screen.queryByRole('menuitemradio', {name: 'Item 399'})
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('menuitemradio', {name: 'A much longer label than the rest'})
      ).toBeInTheDocument();
    });

    it('counts the items inside sections against the threshold', async () => {
      render(
        <DropdownMenu
          triggerLabel="Menu"
          virtualizeThreshold={500}
          items={sectionedItems}
        />,
        {wrapper: ThemeWrapper}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));

      expect(screen.getAllByRole('menuitemradio')).toHaveLength(500);
    });

    it('keeps its items mounted when a search crosses the threshold', async () => {
      render(
        <DropdownMenu
          triggerLabel="Menu"
          search={{placeholder: 'Search items'}}
          items={manyItems}
        />,
        {wrapper: ThemeWrapper}
      );

      await userEvent.click(screen.getByRole('button', {name: 'Menu'}));
      const item = screen.getByRole('menuitemradio', {name: 'Item 1'});

      // Leaves Item 1 and Item 10–19 and 100–199, which is under the threshold.
      await userEvent.type(screen.getByRole('textbox', {name: 'Search items'}), 'Item 1');

      expect(screen.getAllByRole('menuitemradio')).toHaveLength(111);
      expect(screen.getByRole('menuitemradio', {name: 'Item 1'})).toBe(item);
    });

    it.each([
      ['virtualized', undefined],
      ['regular', Infinity],
    ])(
      'measures the separator after a section with the next item in a %s menu',
      async (_, virtualizeThreshold) => {
        render(
          <DropdownMenu
            triggerLabel="Menu"
            virtualizeThreshold={virtualizeThreshold}
            items={[
              {
                key: 'section',
                label: 'Section',
                children: manyItems.slice(0, 2),
              },
              {key: 'after', label: 'After the section'},
              ...manyItems.slice(2),
            ]}
          />,
          {wrapper: ThemeWrapper}
        );

        await userEvent.click(screen.getByRole('button', {name: 'Menu'}));

        const item = screen.getByRole('menuitemradio', {name: 'After the section'});
        // oxlint-disable-next-line testing-library/no-node-access -- The separator and the item share one row element.
        const row = item.closest('li[role="presentation"]');
        expect(row).toBeInTheDocument();
        if (virtualizeThreshold === undefined) {
          expect(row).toHaveAttribute('data-index');
        } else {
          expect(row).not.toHaveAttribute('data-index');
        }
      }
    );
  });
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
