import {Fragment} from 'react';

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
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {cmdkQueryOptions} from 'sentry/components/commandPalette/types';
import {
  CMDKAction,
  CommandPaletteProvider,
} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';

function GlobalActionsComponent({children}: {children?: React.ReactNode}) {
  return (
    <CommandPaletteProvider>
      {children}
      <CommandPalette closeModal={closeModal} />
    </CommandPaletteProvider>
  );
}

/**
 * Renders the slot outlets that live outside CommandPalette in the real app
 * (they are mounted in navigation/index.tsx). Tests that use
 * <CommandPaletteSlot name="…"> must include this component so slot consumers
 * have a registered outlet element to portal into.
 */
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

  it('shift-enter on an internal link opens in a new tab and closes modal', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

    render(
      <GlobalActionsComponent>
        <CMDKAction to="/target/" display={{label: 'Go to route'}} />
      </GlobalActionsComponent>
    );

    await screen.findByRole('textbox', {name: 'Search commands'});
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('target'),
      '_blank',
      'noreferrer'
    );
    expect(closeSpy).toHaveBeenCalledTimes(1);

    openSpy.mockRestore();
  });

  it('shows internal and external trailing link indicators for link actions', async () => {
    render(
      <GlobalActionsComponent>
        <Fragment>
          <CMDKAction to="/target/" display={{label: 'Internal'}} />
          <CMDKAction to="https://docs.sentry.io" display={{label: 'External'}} />
        </Fragment>
      </GlobalActionsComponent>
    );

    const internalAction = await screen.findByRole('option', {name: 'Internal'});
    const externalAction = await screen.findByRole('option', {name: 'External'});

    expect(
      internalAction.querySelector('[data-test-id="command-palette-link-indicator"]')
    ).toHaveAttribute('data-link-type', 'internal');
    expect(
      externalAction.querySelector('[data-test-id="command-palette-link-indicator"]')
    ).toHaveAttribute('data-link-type', 'external');
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
          <CommandPalette closeModal={closeModal} />
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

  describe('resource limit', () => {
    const makeActions = (count: number): CommandPaletteAction[] =>
      Array.from({length: count}, (_, i) => ({
        display: {label: `Action ${i + 1}`},
        to: `/action-${i + 1}/`,
      }));

    it('limits async resource results to 4 by default', async () => {
      const actions = makeActions(6);

      render(
        <GlobalActionsComponent>
          <CMDKAction
            display={{label: 'Async Group'}}
            resource={() =>
              cmdkQueryOptions({
                queryKey: ['test-resource-default-limit'],
                queryFn: () => actions,
              })
            }
          >
            {data =>
              data.map(action =>
                'to' in action ? (
                  <CMDKAction
                    key={action.display.label}
                    display={action.display}
                    to={action.to}
                  />
                ) : null
              )
            }
          </CMDKAction>
        </GlobalActionsComponent>
      );

      await screen.findByRole('option', {name: 'Action 1'});
      const actionOptions = screen
        .getAllByRole('option')
        .filter(el => !el.hasAttribute('aria-disabled'));
      expect(actionOptions).toHaveLength(4);
      expect(screen.queryByRole('option', {name: 'Action 5'})).not.toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Action 6'})).not.toBeInTheDocument();
    });

    it('limits static children when limit prop is set', async () => {
      render(
        <GlobalActionsComponent>
          <CMDKAction display={{label: 'Static Group'}} limit={2}>
            <CMDKAction display={{label: 'Item 1'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 2'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 3'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 4'}} onAction={jest.fn()} />
          </CMDKAction>
        </GlobalActionsComponent>
      );

      await screen.findByRole('option', {name: 'Item 1'});
      const actionOptions = screen
        .getAllByRole('option')
        .filter(el => !el.hasAttribute('aria-disabled'));
      expect(actionOptions).toHaveLength(2);
      expect(screen.queryByRole('option', {name: 'Item 3'})).not.toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Item 4'})).not.toBeInTheDocument();
    });

    it('does not limit static children when limit prop is not set', async () => {
      render(
        <GlobalActionsComponent>
          <CMDKAction display={{label: 'Static Group'}}>
            <CMDKAction display={{label: 'Item 1'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 2'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 3'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 4'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 5'}} onAction={jest.fn()} />
          </CMDKAction>
        </GlobalActionsComponent>
      );

      await screen.findByRole('option', {name: 'Item 5'});
      const actionOptions = screen
        .getAllByRole('option')
        .filter(el => !el.hasAttribute('aria-disabled'));
      expect(actionOptions).toHaveLength(5);
    });

    it('items beyond the limit are still searchable', async () => {
      render(
        <GlobalActionsComponent>
          <CMDKAction display={{label: 'Static Group'}} limit={2}>
            <CMDKAction display={{label: 'Alpha 1'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Alpha 2'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Beta 3'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Beta 4'}} onAction={jest.fn()} />
          </CMDKAction>
        </GlobalActionsComponent>
      );

      // Without a query, only the first 2 items should be visible
      await screen.findByRole('option', {name: 'Alpha 1'});
      expect(screen.queryByRole('option', {name: 'Beta 3'})).not.toBeInTheDocument();

      // Searching for "Beta" should surface items 3 and 4 even though they are
      // beyond the default limit — the limit must be applied after filtering,
      // not before, so it never hides matching results from the user.
      const input = screen.getByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'Beta');

      expect(await screen.findByRole('option', {name: 'Beta 3'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Beta 4'})).toBeInTheDocument();
    });

    it('limit is applied after search — only top matches up to the limit are shown', async () => {
      render(
        <GlobalActionsComponent>
          <CMDKAction display={{label: 'Static Group'}} limit={2}>
            <CMDKAction display={{label: 'Item 1'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 2'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 3'}} onAction={jest.fn()} />
            <CMDKAction display={{label: 'Item 4'}} onAction={jest.fn()} />
          </CMDKAction>
        </GlobalActionsComponent>
      );

      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'Item');

      expect(await screen.findByRole('option', {name: 'Item 1'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Item 2'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Item 3'})).not.toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Item 4'})).not.toBeInTheDocument();
    });

    it('grandchildren do not resurface individually when their parent nested group matches the search query', async () => {
      // Regression: the old seen-set only marked direct children of a group,
      // so grandchildren (children of nested groups) still appeared as independent
      // flat items in search results with no limit applied.
      render(
        <GlobalActionsComponent>
          <CMDKAction display={{label: 'DSN'}}>
            <CMDKAction display={{label: 'Project Keys'}} limit={2}>
              <CMDKAction display={{label: 'Project Alpha'}} onAction={jest.fn()} />
              <CMDKAction display={{label: 'Project Beta'}} onAction={jest.fn()} />
              <CMDKAction display={{label: 'Project Gamma'}} onAction={jest.fn()} />
              <CMDKAction display={{label: 'Project Delta'}} onAction={jest.fn()} />
            </CMDKAction>
          </CMDKAction>
        </GlobalActionsComponent>
      );

      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      // "Project" matches both the nested group label "Project Keys" and all four items.
      await userEvent.type(input, 'Project');

      // "Project Keys" should appear as a flat action under "DSN" (click to drill in).
      expect(
        await screen.findByRole('option', {name: 'Project Keys'})
      ).toBeInTheDocument();

      // Individual project items must NOT surface as standalone options — they are
      // grandchildren and should only be accessible by drilling into "Project Keys".
      expect(
        screen.queryByRole('option', {name: 'Project Alpha'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('option', {name: 'Project Beta'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('option', {name: 'Project Gamma'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('option', {name: 'Project Delta'})
      ).not.toBeInTheDocument();
    });

    it('limit is applied after search for async resource results', async () => {
      const actions = makeActions(6);

      render(
        <GlobalActionsComponent>
          <CMDKAction
            display={{label: 'Async Group'}}
            limit={2}
            resource={() =>
              cmdkQueryOptions({
                queryKey: ['test-resource-search-limit'],
                queryFn: () => actions,
              })
            }
          >
            {data =>
              data.map(action =>
                'to' in action ? (
                  <CMDKAction
                    key={action.display.label}
                    display={action.display}
                    to={action.to}
                  />
                ) : null
              )
            }
          </CMDKAction>
        </GlobalActionsComponent>
      );

      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'Action');

      expect(await screen.findByRole('option', {name: 'Action 1'})).toBeInTheDocument();
      expect(screen.getByRole('option', {name: 'Action 2'})).toBeInTheDocument();
      expect(screen.queryByRole('option', {name: 'Action 3'})).not.toBeInTheDocument();
    });

    it('respects a custom limit prop', async () => {
      const actions = makeActions(6);

      render(
        <GlobalActionsComponent>
          <CMDKAction
            display={{label: 'Async Group'}}
            limit={2}
            resource={() =>
              cmdkQueryOptions({
                queryKey: ['test-resource-custom-limit'],
                queryFn: () => actions,
              })
            }
          >
            {data =>
              data.map(action =>
                'to' in action ? (
                  <CMDKAction
                    key={action.display.label}
                    display={action.display}
                    to={action.to}
                  />
                ) : null
              )
            }
          </CMDKAction>
        </GlobalActionsComponent>
      );

      await screen.findByRole('option', {name: 'Action 1'});
      const actionOptions = screen
        .getAllByRole('option')
        .filter(el => !el.hasAttribute('aria-disabled'));
      expect(actionOptions).toHaveLength(2);
    });
  });

  describe('prompt actions', () => {
    function PromptAction() {
      return (
        <CMDKAction display={{label: 'DSN Tools'}}>
          <CMDKAction
            display={{label: 'Reverse DSN lookup'}}
            prompt="Paste a DSN..."
            resource={() =>
              cmdkQueryOptions({
                queryKey: ['prompt-action-test'],
                queryFn: () => null,
                enabled: false,
              })
            }
          />
        </CMDKAction>
      );
    }

    it('a top-level prompt action is not filtered out in browse mode', async () => {
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'Reverse DSN lookup'}} prompt="Paste a DSN..." />
          <CommandPalette />
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
    it('task slot action is displayed in the palette', async () => {
      render(
        <CommandPaletteProvider>
          <CommandPaletteSlot name="task">
            <CMDKAction display={{label: 'Task Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <SlotOutlets />
          <CommandPalette closeModal={jest.fn()} />
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
          <CommandPaletteSlot name="task">
            <CMDKAction display={{label: 'Task Action'}} onAction={onAction} />
          </CommandPaletteSlot>
          <SlotOutlets />
          <CommandPalette closeModal={jest.fn()} />
        </CommandPaletteProvider>
      );

      await userEvent.click(await screen.findByRole('option', {name: 'Task Action'}));
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('page slot action is displayed in the palette', async () => {
      render(
        <CommandPaletteProvider>
          <CommandPaletteSlot name="page">
            <CMDKAction display={{label: 'Page Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <SlotOutlets />
          <CommandPalette closeModal={jest.fn()} />
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
          <CommandPaletteSlot name="page">
            <CMDKAction display={{label: 'Page Action'}} onAction={onAction} />
          </CommandPaletteSlot>
          <SlotOutlets />
          <CommandPalette closeModal={jest.fn()} />
        </CommandPaletteProvider>
      );

      await userEvent.click(await screen.findByRole('option', {name: 'Page Action'}));
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('page slot actions are rendered before global actions', async () => {
      // This test mirrors the real app structure:
      //   - Global actions are registered directly in CMDKCollection (e.g. from the nav sidebar)
      //   - Page-specific actions are registered via <CommandPaletteSlot name="page">
      //
      // Expected: page slot actions appear first in the list, global actions second.
      // The "page" outlet is rendered above the "global" outlet inside CommandPalette,
      // so page slot actions should always take priority in the list order.
      render(
        <CommandPaletteProvider>
          {/* Global action registered directly — simulates e.g. GlobalCommandPaletteActions */}
          <CMDKAction display={{label: 'Global Action'}} onAction={jest.fn()} />
          {/* Page-specific action portaled via the page slot */}
          <CommandPaletteSlot name="page">
            <CMDKAction display={{label: 'Page Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <SlotOutlets />
          <CommandPalette closeModal={jest.fn()} />
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
          <CommandPaletteSlot name="global">
            <CMDKAction display={{label: 'Global Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <CommandPaletteSlot name="page">
            <CMDKAction display={{label: 'Page Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <CommandPaletteSlot name="task">
            <CMDKAction display={{label: 'Task Action'}} onAction={jest.fn()} />
          </CommandPaletteSlot>
          <SlotOutlets />
          <CommandPalette closeModal={jest.fn()} />
        </CommandPaletteProvider>
      );

      const options = await screen.findAllByRole('option');
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveAccessibleName('Task Action');
      expect(options[1]).toHaveAccessibleName('Page Action');
      expect(options[2]).toHaveAccessibleName('Global Action');
    });

    it('actions registered via a slot consumer are not duplicated', async () => {
      // GlobalCommandPaletteActions uses <CommandPaletteSlot name="global"> internally.
      // The slot consumer portals children into the outlet element. Registration must be
      // idempotent so the slot→portal transition never yields duplicates.
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
          <ActionsViaGlobalSlot />
          <SlotOutlets />
          <CommandPalette closeModal={jest.fn()} />
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
          <CommandPalette closeModal={jest.fn()} />
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
          <CommandPalette closeModal={jest.fn()} />
        </CommandPaletteProvider>
      );

      await screen.findByRole('option', {name: 'Direct Action'});
      expect(screen.getAllByRole('option', {name: 'Direct Action'})).toHaveLength(1);
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
  });

  describe('resource action with 0 results', () => {
    function emptyResource() {
      return cmdkQueryOptions({
        queryKey: ['test-empty-resource'] as const,
        queryFn: (): CommandPaletteAction[] => [],
      });
    }

    it('is omitted from browse mode at the top level', async () => {
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'Async Resource'}} resource={emptyResource}>
            {data =>
              data.map((_, i) => (
                <CMDKAction key={i} to="/x/" display={{label: 'Result'}} />
              ))
            }
          </CMDKAction>
          <CMDKAction display={{label: 'Real Action'}} onAction={jest.fn()} />
          <CommandPalette closeModal={jest.fn()} />
        </CommandPaletteProvider>
      );

      await screen.findByRole('option', {name: 'Real Action'});
      expect(
        screen.queryByRole('option', {name: 'Async Resource'})
      ).not.toBeInTheDocument();
    });

    it('is omitted from browse mode when nested inside a group', async () => {
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'Group'}}>
            <CMDKAction display={{label: 'Async Resource'}} resource={emptyResource}>
              {data =>
                data.map((_, i) => (
                  <CMDKAction key={i} to="/x/" display={{label: 'Result'}} />
                ))
              }
            </CMDKAction>
            <CMDKAction display={{label: 'Real Action'}} onAction={jest.fn()} />
          </CMDKAction>
          <CommandPalette closeModal={jest.fn()} />
        </CommandPaletteProvider>
      );

      await screen.findByRole('option', {name: 'Real Action'});
      expect(
        screen.queryByRole('option', {name: 'Async Resource'})
      ).not.toBeInTheDocument();
    });

    it('group whose only children are empty resource nodes is omitted entirely in browse mode', async () => {
      // Regression: browse mode pushed the section header unconditionally before
      // iterating children. If every child was an empty resource node and got
      // skipped, an orphaned, non-selectable section header was left in the list.
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'All Empty Group'}}>
            <CMDKAction display={{label: 'Async Resource'}} resource={emptyResource}>
              {data =>
                data.map((_, i) => (
                  <CMDKAction key={i} to="/x/" display={{label: 'Result'}} />
                ))
              }
            </CMDKAction>
          </CMDKAction>
          <CMDKAction display={{label: 'Real Action'}} onAction={jest.fn()} />
          <CommandPalette closeModal={jest.fn()} />
        </CommandPaletteProvider>
      );

      await screen.findByRole('option', {name: 'Real Action'});
      // Neither the section header nor any item for the all-empty group should appear.
      expect(
        screen.queryByRole('option', {name: 'All Empty Group'})
      ).not.toBeInTheDocument();
    });

    it('is omitted from search mode when nested inside a group whose label matches the query', async () => {
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'Navigate'}}>
            <CMDKAction display={{label: 'Async Resource'}} resource={emptyResource}>
              {data =>
                data.map((_, i) => (
                  <CMDKAction key={i} to="/x/" display={{label: 'Result'}} />
                ))
              }
            </CMDKAction>
          </CMDKAction>
          <CMDKAction display={{label: 'Other'}} onAction={jest.fn()} />
          <CommandPalette closeModal={jest.fn()} />
        </CommandPaletteProvider>
      );

      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'navigate');

      // Wait for search to take effect — 'Other' should be filtered out since it doesn't match
      await waitFor(() => {
        expect(screen.queryByRole('option', {name: 'Other'})).not.toBeInTheDocument();
      });
      expect(
        screen.queryByRole('option', {name: 'Async Resource'})
      ).not.toBeInTheDocument();
    });

    it('is omitted from search mode even when the label matches the query', async () => {
      render(
        <CommandPaletteProvider>
          <CMDKAction display={{label: 'Async Resource'}} resource={emptyResource}>
            {data =>
              data.map((_, i) => (
                <CMDKAction key={i} to="/x/" display={{label: 'Result'}} />
              ))
            }
          </CMDKAction>
          <CMDKAction display={{label: 'Other'}} onAction={jest.fn()} />
          <CommandPalette closeModal={jest.fn()} />
        </CommandPaletteProvider>
      );

      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'async');

      // Wait for search to take effect — 'Other' should be filtered out since it doesn't match
      await waitFor(() => {
        expect(screen.queryByRole('option', {name: 'Other'})).not.toBeInTheDocument();
      });
      expect(
        screen.queryByRole('option', {name: 'Async Resource'})
      ).not.toBeInTheDocument();
    });
  });
});
