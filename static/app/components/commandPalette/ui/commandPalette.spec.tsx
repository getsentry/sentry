import {Fragment, useCallback} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

jest.unmock('lodash/debounce');

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({count}: {count: number}) => {
    const virtualItems = Array.from({length: count}, (_, index) => ({
      key: index,
      index,
      start: index * 48,
      size: 48,
      lane: 0,
    }));
    return {
      getVirtualItems: () => virtualItems,
      getTotalSize: () => count * 48,
      measureElement: jest.fn(),
      measure: jest.fn(),
    };
  },
}));

import {closeModal} from 'sentry/actionCreators/modal';
import * as modalActions from 'sentry/actionCreators/modal';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/ui/cmdk';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import type {CMDKActionData} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {useNavigate} from 'sentry/utils/useNavigate';

function GlobalActionsComponent({children}: {children?: React.ReactNode}) {
  const navigate = useNavigate();

  const handleAction = useCallback(
    (action: CollectionTreeNode<CMDKActionData>) => {
      if ('to' in action) {
        navigate(action.to);
      } else if ('onAction' in action) {
        action.onAction();
      }
      closeModal();
    },
    [navigate]
  );

  return (
    <CommandPaletteProvider>
      {children}
      <CommandPalette onAction={handleAction} />
    </CommandPaletteProvider>
  );
}

const onChild = jest.fn();

function AllActions() {
  return (
    <Fragment>
      <CMDKAction to="/target/" display={{label: 'Go to route'}} />
      <CMDKAction to="/other/" display={{label: 'Other'}} />
      <CMDKAction display={{label: 'Parent Label'}}>
        <CMDKAction display={{label: 'Parent Group Action'}}>
          <CMDKAction onAction={onChild} display={{label: 'Child Action'}} />
        </CMDKAction>
      </CMDKAction>
    </Fragment>
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('clicking a link item navigates and closes modal', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    const {router} = render(
      <GlobalActionsComponent>
        <AllActions />
      </GlobalActionsComponent>
    );
    await userEvent.click(await screen.findByRole('option', {name: 'Go to route'}));

    await waitFor(() => expect(router.location.pathname).toBe('/target/'));
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('ArrowDown to a link item then Enter navigates and closes modal', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    const {router} = render(
      <GlobalActionsComponent>
        <AllActions />
      </GlobalActionsComponent>
    );
    await screen.findByRole('textbox', {name: 'Search commands'});
    // First item should already be highlighted, arrow down will go highlight "other"
    await userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => expect(router.location.pathname).toBe('/other/'));
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking action with children shows sub-items, backspace returns', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    render(
      <GlobalActionsComponent>
        <AllActions />
      </GlobalActionsComponent>
    );

    // Open children
    await userEvent.click(
      await screen.findByRole('option', {name: 'Parent Group Action'})
    );

    // Textbox changes placeholder to parent Label label
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Search commands'})).toHaveAttribute(
        'placeholder',
        'Search inside Parent Group Action...'
      );
    });

    // // Child actions are visible, global actions are not
    expect(screen.getByRole('option', {name: 'Child Action'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Parent Label'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Go to route'})).not.toBeInTheDocument();

    // // Hit Backspace on the input to go back
    await userEvent.keyboard('{Backspace}');

    // // Back to main actions
    expect(await screen.findByRole('option', {name: 'Parent Label'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Child Action'})).not.toBeInTheDocument();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('clicking child sub-item runs onAction and closes modal', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    render(
      <GlobalActionsComponent>
        <AllActions />
      </GlobalActionsComponent>
    );
    await userEvent.click(
      await screen.findByRole('option', {name: 'Parent Group Action'})
    );
    await userEvent.click(await screen.findByRole('option', {name: 'Child Action'}));

    expect(onChild).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  describe('search', () => {
    it('typing a query filters results to matching items only', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'route');

      expect(
        await screen.findByRole('option', {name: 'Go to route'})
      ).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Other'})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('option', {name: 'Parent Label'})
      ).not.toBeInTheDocument();
    });

    it('non-matching items are not shown', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'xyzzy');

      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });

    it('clearing the query restores all top-level items', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'route');
      expect(
        await screen.findByRole('option', {name: 'Go to route'})
      ).toBeInTheDocument();

      await userEvent.clear(input);

      expect(
        await screen.findByRole('option', {name: 'Go to route'})
      ).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Other'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Parent Label'})).toBeInTheDocument();
    });

    it('child actions are not shown when query is empty', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      await screen.findByRole('option', {name: 'Parent Group Action'});

      expect(
        screen.queryByRole('option', {name: 'Child Action'})
      ).not.toBeInTheDocument();
    });

    it('child actions are directly searchable without drilling into the group', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'child');

      expect(
        await screen.findByRole('option', {name: 'Child Action'})
      ).toBeInTheDocument();
    });

    it('preserves spaces in typed query', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });

    it('search is case-insensitive', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'ROUTE');

      expect(
        await screen.findByRole('option', {name: 'Go to route'})
      ).toBeInTheDocument();
    });

    it('actions are ranked by match quality — better matches appear first', async () => {
      render(
        <GlobalActionsComponent>
          <CMDKAction to="/a/" display={{label: 'Something with issues buried'}} />
          <CMDKAction to="/b/" display={{label: 'Issues'}} />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'issues');

      const options = (await screen.findAllByRole('option')).filter(
        el => !el.hasAttribute('aria-disabled')
      );
      expect(options[0]).toHaveAccessibleName('Something with issues buried');
      expect(options[1]).toHaveAccessibleName('Issues');
    });

    it('top-level actions rank before child actions when both match the query', async () => {
      render(
        <GlobalActionsComponent>
          <CMDKAction display={{label: 'Group'}}>
            <CMDKAction to="/child/" display={{label: 'Issues child'}} />
          </CMDKAction>
          <CMDKAction to="/top/" display={{label: 'Issues'}} />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'issues');

      const options = (await screen.findAllByRole('option')).filter(
        el => !el.hasAttribute('aria-disabled')
      );
      expect(options[0]).toHaveAccessibleName('Issues child');
      expect(options[1]).toHaveAccessibleName('Issues');
    });

    it('actions with matching keywords are included in results', async () => {
      render(
        <GlobalActionsComponent>
          <CMDKAction
            to="/shortcuts/"
            display={{label: 'Keyboard shortcuts'}}
            keywords={['hotkeys', 'keybindings']}
          />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'hotkeys');

      expect(
        await screen.findByRole('option', {name: 'Keyboard shortcuts'})
      ).toBeInTheDocument();
    });

    it("searching within a drilled-in group filters that group's children", async () => {
      render(
        <GlobalActionsComponent>
          <CMDKAction display={{label: 'Theme'}}>
            <CMDKAction onAction={jest.fn()} display={{label: 'Light'}} />
            <CMDKAction onAction={jest.fn()} display={{label: 'Dark'}} />
          </CMDKAction>
        </GlobalActionsComponent>
      );

      // Drill into the group
      await userEvent.click(await screen.findByRole('option', {name: 'Theme'}));
      await screen.findByRole('option', {name: 'Light'});

      // Now type a query that only matches one child
      const input = screen.getByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'dark');

      expect(await screen.findByRole('option', {name: 'Dark'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Light'})).not.toBeInTheDocument();
    });
  });

  describe('action with onAction and children', () => {
    it('invokes callback, keeps modal open, and then shows children for secondary selection', async () => {
      const primaryCallback = jest.fn();
      const secondaryCallback = jest.fn();
      const closeSpy = jest.spyOn(modalActions, 'closeModal');

      // Mirror the updated modal.tsx handleSelect: invoke callback, skip close when
      // action has children so the palette can push into the secondary actions.
      const handleAction = (action: CollectionTreeNode<CMDKActionData>) => {
        if ('onAction' in action) {
          action.onAction();
          if (action.children.length > 0) {
            return;
          }
        }
        closeModal();
      };

      // Top-level groups become section headers (disabled), so the action-with-callback
      // must be a child item — matching how "Parent Group Action" works in allActions.
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'Outer Group'}}>
            <CMDKAction display={{label: 'Primary Action'}} onAction={primaryCallback}>
              <CMDKAction
                display={{label: 'Secondary Action'}}
                onAction={secondaryCallback}
              />
            </CMDKAction>
          </CMDKAction>
          <CommandPalette onAction={handleAction} />
        </CommandPaletteProvider>
      );

      // Select the primary action (has both onAction and children)
      await userEvent.click(await screen.findByRole('option', {name: 'Primary Action'}));

      // Callback should have been invoked
      expect(primaryCallback).toHaveBeenCalledTimes(1);

      // Modal must remain open — no close call yet
      expect(closeSpy).not.toHaveBeenCalled();

      // The palette should have pushed into the children
      expect(
        await screen.findByRole('option', {name: 'Secondary Action'})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('option', {name: 'Primary Action'})
      ).not.toBeInTheDocument();

      // Selecting the secondary action should invoke its callback and close the modal
      await userEvent.click(screen.getByRole('option', {name: 'Secondary Action'}));
      expect(secondaryCallback).toHaveBeenCalledTimes(1);
      expect(closeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('prompt actions', () => {
    function PromptAction() {
      return (
        <CMDKAction display={{label: 'DSN Tools'}}>
          <CMDKAction
            display={{label: 'Reverse DSN lookup'}}
            prompt="Paste a DSN..."
            resource={() => ({
              queryKey: ['prompt-action-test'],
              queryFn: () => null,
              enabled: false,
            })}
          />
        </CMDKAction>
      );
    }

    it('a top-level prompt action is not filtered out in browse mode', async () => {
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'Reverse DSN lookup'}} prompt="Paste a DSN..." />
          <CommandPalette onAction={jest.fn()} />
        </CommandPaletteProvider>
      );
      expect(
        await screen.findByRole('option', {name: 'Reverse DSN lookup'})
      ).toBeInTheDocument();
    });

    it('a prompt action appearing as a direct top-level child after drilling into its parent group is visible', async () => {
      render(
        <GlobalActionsComponent>
          <CMDKAction display={{label: 'Outer'}}>
            <CMDKAction display={{label: 'Inner Group'}}>
              <CMDKAction display={{label: 'Prompt Child'}} prompt="Enter value..." />
            </CMDKAction>
          </CMDKAction>
        </GlobalActionsComponent>
      );

      // Drill into Inner Group (shown as an action item under Outer)
      await userEvent.click(await screen.findByRole('option', {name: 'Inner Group'}));

      // Prompt Child must be visible — previously it was filtered out by flattenActions
      expect(
        await screen.findByRole('option', {name: 'Prompt Child'})
      ).toBeInTheDocument();
    });

    it('clicking a prompt action pushes onto the nav stack instead of closing', async () => {
      const closeSpy = jest.spyOn(modalActions, 'closeModal');
      render(
        <GlobalActionsComponent>
          <PromptAction />
        </GlobalActionsComponent>
      );

      await userEvent.click(
        await screen.findByRole('option', {name: 'Reverse DSN lookup'})
      );

      expect(closeSpy).not.toHaveBeenCalled();
    });

    it('shows the prompt as the input placeholder when inside a prompt action context', async () => {
      render(
        <GlobalActionsComponent>
          <PromptAction />
        </GlobalActionsComponent>
      );

      await userEvent.click(
        await screen.findByRole('option', {name: 'Reverse DSN lookup'})
      );

      await waitFor(() => {
        expect(screen.getByRole('textbox', {name: 'Search commands'})).toHaveAttribute(
          'placeholder',
          'Paste a DSN...'
        );
      });
    });

    it('clears the input query when entering a prompt action context', async () => {
      render(
        <GlobalActionsComponent>
          <PromptAction />
        </GlobalActionsComponent>
      );

      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'reverse');
      await userEvent.click(
        await screen.findByRole('option', {name: 'Reverse DSN lookup'})
      );

      await waitFor(() => expect(input).toHaveValue(''));
    });

    it('backspace from prompt context restores the previous query', async () => {
      render(
        <GlobalActionsComponent>
          <PromptAction />
        </GlobalActionsComponent>
      );

      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'reverse');
      await userEvent.click(
        await screen.findByRole('option', {name: 'Reverse DSN lookup'})
      );
      await waitFor(() => expect(input).toHaveValue(''));

      await userEvent.keyboard('{Backspace}');

      await waitFor(() => expect(input).toHaveValue('reverse'));
    });
  });

  describe('query restoration', () => {
    it('drilling into a group clears the active query', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});

      // Type a query that shows the group in search results
      await userEvent.type(input, 'parent');
      await screen.findByRole('option', {name: 'Parent Group Action'});

      // Drill into the group by clicking the group item itself — input should be cleared
      await userEvent.click(screen.getByRole('option', {name: 'Parent Group Action'}));

      await waitFor(() => expect(input).toHaveValue(''));
    });

    it('Backspace from a drilled group restores the query that was active before drilling in', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});

      // Type a query, then drill into the group that appears in search results
      await userEvent.type(input, 'parent');
      await userEvent.click(
        await screen.findByRole('option', {name: 'Parent Group Action'})
      );
      await screen.findByRole('option', {name: 'Child Action'});

      // Go back with Backspace — the pre-drill query should be restored
      await userEvent.keyboard('{Backspace}');

      await waitFor(() => expect(input).toHaveValue('parent'));
    });

    it('clicking the back button from a drilled group restores the query that was active before drilling in', async () => {
      render(
        <GlobalActionsComponent>
          <AllActions />
        </GlobalActionsComponent>
      );
      const input = await screen.findByRole('textbox', {name: 'Search commands'});

      // Type a query, then drill into the group that appears in search results
      await userEvent.type(input, 'parent');
      await userEvent.click(
        await screen.findByRole('option', {name: 'Parent Group Action'})
      );
      await screen.findByRole('option', {name: 'Child Action'});

      // Go back with the back button — the pre-drill query should be restored
      await userEvent.click(
        screen.getByRole('button', {name: 'Return to previous action'})
      );

      await waitFor(() => expect(input).toHaveValue('parent'));
    });
  });

  describe('slot rendering', () => {
    // Outlets live in the navigation in production; tests that exercise slot
    // behaviour must render them explicitly so slot consumers have a target to
    // portal into.
    function SlotOutlets() {
      return (
        <div style={{display: 'none'}}>
          <CommandPaletteSlot.Outlet name="task">
            {p => <div {...p} />}
          </CommandPaletteSlot.Outlet>
          <CommandPaletteSlot.Outlet name="page">
            {p => <div {...p} />}
          </CommandPaletteSlot.Outlet>
          <CommandPaletteSlot.Outlet name="global">
            {p => <div {...p} />}
          </CommandPaletteSlot.Outlet>
        </div>
      );
    }

    it('task slot action is displayed in the palette', async () => {
      render(
        <CommandPaletteProvider>
          <SlotOutlets />
          <CommandPaletteSlot name="task">
            <CMDKAction display={{label: 'Task Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <CommandPalette onAction={jest.fn()} />
        </CommandPaletteProvider>
      );

      expect(
        await screen.findByRole('option', {name: 'Task Action'})
      ).toBeInTheDocument();
      expect(screen.getAllByRole('option', {name: 'Task Action'})).toHaveLength(1);
    });

    it('task slot action triggers its callback when selected', async () => {
      const onAction = jest.fn();
      render(
        <CommandPaletteProvider>
          <SlotOutlets />
          <CommandPaletteSlot name="task">
            <CMDKAction display={{label: 'Task Action'}} onAction={onAction} />
          </CommandPaletteSlot>
          <CommandPalette
            onAction={node => ('onAction' in node ? node.onAction() : null)}
          />
        </CommandPaletteProvider>
      );

      await userEvent.click(await screen.findByRole('option', {name: 'Task Action'}));
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('page slot action is displayed in the palette', async () => {
      render(
        <CommandPaletteProvider>
          <SlotOutlets />
          <CommandPaletteSlot name="page">
            <CMDKAction display={{label: 'Page Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <CommandPalette onAction={jest.fn()} />
        </CommandPaletteProvider>
      );

      expect(
        await screen.findByRole('option', {name: 'Page Action'})
      ).toBeInTheDocument();
      expect(screen.getAllByRole('option', {name: 'Page Action'})).toHaveLength(1);
    });

    it('page slot action triggers its callback when selected', async () => {
      const onAction = jest.fn();
      render(
        <CommandPaletteProvider>
          <SlotOutlets />
          <CommandPaletteSlot name="page">
            <CMDKAction display={{label: 'Page Action'}} onAction={onAction} />
          </CommandPaletteSlot>
          <CommandPalette
            onAction={node => ('onAction' in node ? node.onAction() : null)}
          />
        </CommandPaletteProvider>
      );

      await userEvent.click(await screen.findByRole('option', {name: 'Page Action'}));
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('page slot actions are rendered before global actions', async () => {
      // This test mirrors the real app structure:
      //   - Global actions are registered via <CommandPaletteSlot name="global"> from the nav
      //   - Page-specific actions are registered via <CommandPaletteSlot name="page">
      //
      // Expected: page slot actions appear first in the list, global actions second.
      // The outlets are rendered in task→page→global DOM order (matching navigation),
      // so compareDocumentPosition sorts them correctly.
      render(
        <CommandPaletteProvider>
          <SlotOutlets />
          <CommandPaletteSlot name="global">
            <CMDKAction display={{label: 'Global Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <CommandPaletteSlot name="page">
            <CMDKAction display={{label: 'Page Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <CommandPalette onAction={jest.fn()} />
        </CommandPaletteProvider>
      );

      const options = await screen.findAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveAccessibleName('Page Action');
      expect(options[1]).toHaveAccessibleName('Global Action');
    });

    it('task < page < global ordering when all three slots are populated', async () => {
      render(
        <CommandPaletteProvider>
          <SlotOutlets />
          <CommandPaletteSlot name="global">
            <CMDKAction display={{label: 'Global Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <CommandPaletteSlot name="page">
            <CMDKAction display={{label: 'Page Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <CommandPaletteSlot name="task">
            <CMDKAction display={{label: 'Task Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <CommandPalette onAction={jest.fn()} />
        </CommandPaletteProvider>
      );

      const options = await screen.findAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveAccessibleName('Task Action');
      expect(options[1]).toHaveAccessibleName('Page Action');
      expect(options[2]).toHaveAccessibleName('Global Action');
    });

    it('global slot actions registered outside CommandPalette are not duplicated', async () => {
      // Mirrors the real app setup where GlobalCommandPaletteActions lives in the nav
      // (a sibling of CommandPalette, not a child), portaling into the global outlet.
      // The collection registration must be idempotent.
      function ActionsViaGlobalSlot() {
        return (
          <CommandPaletteSlot name="global">
            <CMDKAction display={{label: 'Action A'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Action B'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
        );
      }

      render(
        <CommandPaletteProvider>
          <SlotOutlets />
          <ActionsViaGlobalSlot />
          <CommandPalette onAction={jest.fn()} />
        </CommandPaletteProvider>
      );

      await screen.findByRole('option', {name: 'Action A'});

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(screen.getAllByRole('option', {name: 'Action A'})).toHaveLength(1);
      expect(screen.getAllByRole('option', {name: 'Action B'})).toHaveLength(1);
    });

    it('a group with no children is omitted from the list', async () => {
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'Empty Group'}} />
          <CMDKAction display={{label: 'Real Action'}} onAction={jest.fn()} />
          <CommandPalette onAction={jest.fn()} />
        </CommandPaletteProvider>
      );

      expect(
        await screen.findByRole('option', {name: 'Real Action'})
      ).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Empty Group'})).not.toBeInTheDocument();
    });

    it('direct CMDKAction registrations outside slots are not duplicated', async () => {
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'Direct Action'}} onAction={jest.fn()} />
          <CommandPalette onAction={jest.fn()} />
        </CommandPaletteProvider>
      );

      await screen.findByRole('option', {name: 'Direct Action'});
      expect(screen.getAllByRole('option', {name: 'Direct Action'})).toHaveLength(1);
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
  });
});
