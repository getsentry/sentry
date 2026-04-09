import {useCallback} from 'react';

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
import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import {useCommandPaletteActionsRegister} from 'sentry/components/commandPalette/context';
import type {
  CommandPaletteAction,
  CommandPaletteActionWithKey,
} from 'sentry/components/commandPalette/types';
import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
import {useNavigate} from 'sentry/utils/useNavigate';

function RegisterActions({actions}: {actions: CommandPaletteAction[]}) {
  useCommandPaletteActionsRegister(actions);
  return null;
}

function GlobalActionsComponent({
  actions,
  children,
}: {
  actions: CommandPaletteAction[];
  children?: React.ReactNode;
}) {
  const navigate = useNavigate();

  const handleAction = useCallback(
    (action: CommandPaletteActionWithKey) => {
      if ('to' in action) {
        navigate(action.to);
      } else if ('onAction' in action) {
        action.onAction();
      } else {
        // @TODO: implement async actions
      }
      closeModal();
    },
    [navigate]
  );

  return (
    <CommandPaletteProvider>
      <RegisterActions actions={actions} />
      <CommandPalette onAction={handleAction} />
      {children}
    </CommandPaletteProvider>
  );
}

const onChild = jest.fn();

const allActions: CommandPaletteAction[] = [
  {
    to: '/target/',
    display: {
      label: 'Go to route',
    },
  },
  {
    to: '/other/',
    display: {label: 'Other'},
  },
  {
    display: {label: 'Parent Label'},
    actions: [
      {
        display: {label: 'Parent Group Action'},
        actions: [
          {
            onAction: onChild,
            display: {label: 'Child Action'},
          },
        ],
      },
    ],
  },
];

describe('CommandPalette', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('clicking a link item navigates and closes modal', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    const {router} = render(<GlobalActionsComponent actions={allActions} />);
    await userEvent.click(await screen.findByRole('option', {name: 'Go to route'}));

    await waitFor(() => expect(router.location.pathname).toBe('/target/'));
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('ArrowDown to a link item then Enter navigates and closes modal', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    const {router} = render(<GlobalActionsComponent actions={allActions} />);
    await screen.findByRole('textbox', {name: 'Search commands'});
    // First item should already be highlighted, arrow down will go highlight "other"
    await userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => expect(router.location.pathname).toBe('/other/'));
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking action with children shows sub-items, backspace returns', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    render(<GlobalActionsComponent actions={allActions} />);

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
    render(<GlobalActionsComponent actions={allActions} />);
    await userEvent.click(
      await screen.findByRole('option', {name: 'Parent Group Action'})
    );
    await userEvent.click(await screen.findByRole('option', {name: 'Child Action'}));

    expect(onChild).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  describe('search', () => {
    it('typing a query filters results to matching items only', async () => {
      render(<GlobalActionsComponent actions={allActions} />);
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
      render(<GlobalActionsComponent actions={allActions} />);
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'xyzzy');

      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });

    it('clearing the query restores all top-level items', async () => {
      render(<GlobalActionsComponent actions={allActions} />);
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
      render(<GlobalActionsComponent actions={allActions} />);
      await screen.findByRole('option', {name: 'Parent Group Action'});

      expect(
        screen.queryByRole('option', {name: 'Child Action'})
      ).not.toBeInTheDocument();
    });

    it('child actions are directly searchable without drilling into the group', async () => {
      render(<GlobalActionsComponent actions={allActions} />);
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'child');

      expect(
        await screen.findByRole('option', {name: 'Child Action'})
      ).toBeInTheDocument();
    });

    it('preserves spaces in typed query', async () => {
      render(<GlobalActionsComponent actions={allActions} />);
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });

    it('search is case-insensitive', async () => {
      render(<GlobalActionsComponent actions={allActions} />);
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'ROUTE');

      expect(
        await screen.findByRole('option', {name: 'Go to route'})
      ).toBeInTheDocument();
    });

    it('actions are ranked by match quality — better matches appear first', async () => {
      const actions: CommandPaletteAction[] = [
        {
          to: '/a/',
          display: {label: 'Something with issues buried'},
        },
        {
          to: '/b/',
          display: {label: 'Issues'},
        },
      ];
      render(<GlobalActionsComponent actions={actions} />);
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'issues');

      const options = (await screen.findAllByRole('option')).filter(
        el => !el.hasAttribute('aria-disabled')
      );
      expect(options[0]).toHaveAccessibleName('Something with issues buried');
      expect(options[1]).toHaveAccessibleName('Issues');
    });

    it('top-level actions rank before child actions when both match the query', async () => {
      const actions: CommandPaletteAction[] = [
        {
          display: {label: 'Group'},
          actions: [{to: '/child/', display: {label: 'Issues child'}}],
        },
        {
          to: '/top/',
          display: {label: 'Issues'},
        },
      ];
      render(<GlobalActionsComponent actions={actions} />);
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'issues');

      const options = (await screen.findAllByRole('option')).filter(
        el => !el.hasAttribute('aria-disabled')
      );
      expect(options[0]).toHaveAccessibleName('Issues child');
      expect(options[1]).toHaveAccessibleName('Issues');
    });

    it('actions with matching keywords are included in results', async () => {
      const actions: CommandPaletteAction[] = [
        {
          to: '/shortcuts/',
          display: {label: 'Keyboard shortcuts'},
          keywords: ['hotkeys', 'keybindings'],
        },
      ];
      render(<GlobalActionsComponent actions={actions} />);
      const input = await screen.findByRole('textbox', {name: 'Search commands'});
      await userEvent.type(input, 'hotkeys');

      expect(
        await screen.findByRole('option', {name: 'Keyboard shortcuts'})
      ).toBeInTheDocument();
    });

    it("searching within a drilled-in group filters that group's children", async () => {
      const actions: CommandPaletteAction[] = [
        {
          display: {label: 'Theme'},
          actions: [
            {onAction: jest.fn(), display: {label: 'Light'}},
            {onAction: jest.fn(), display: {label: 'Dark'}},
          ],
        },
      ];
      render(<GlobalActionsComponent actions={actions} />);

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

  describe('query restoration', () => {
    it('drilling into a group clears the active query', async () => {
      render(<GlobalActionsComponent actions={allActions} />);
      const input = await screen.findByRole('textbox', {name: 'Search commands'});

      // Type a query that shows the group in search results
      await userEvent.type(input, 'parent');
      await screen.findByRole('option', {name: 'Parent Group Action'});

      // Drill into the group by clicking the group item itself — input should be cleared
      await userEvent.click(screen.getByRole('option', {name: 'Parent Group Action'}));

      await waitFor(() => expect(input).toHaveValue(''));
    });

    it('Backspace from a drilled group restores the query that was active before drilling in', async () => {
      render(<GlobalActionsComponent actions={allActions} />);
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
      render(<GlobalActionsComponent actions={allActions} />);
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
});
