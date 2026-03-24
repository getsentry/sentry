import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modalActions from 'sentry/actionCreators/modal';
import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {CommandPaletteContent} from 'sentry/components/commandPalette/ui/content';
import {useCommandPaletteActions} from 'sentry/components/commandPalette/useCommandPaletteActions';

function RegisterActions({actions}: {actions: CommandPaletteAction[]}) {
  useCommandPaletteActions(actions);
  return null;
}

function GlobalActionsComponent({
  actions,
  children,
}: {
  actions: CommandPaletteAction[];
  children?: React.ReactNode;
}) {
  return (
    <CommandPaletteProvider>
      <RegisterActions actions={actions} />
      <CommandPaletteContent />
      {children}
    </CommandPaletteProvider>
  );
}

const onChild = jest.fn();

const globalActions: CommandPaletteAction[] = [
  {
    to: '/target/',
    groupingKey: 'navigate',
    display: {
      label: 'Go to route',
    },
    type: 'navigate',
  },
  {
    to: '/other/',
    groupingKey: 'help',
    display: {label: 'Other'},
    type: 'navigate',
  },
  {
    groupingKey: 'add',
    display: {label: 'Parent action'},
    actions: [
      {
        onAction: onChild,
        display: {label: 'Child action'},
        type: 'callback',
      },
    ],
    type: 'group',
  },
];

describe('CommandPaletteContent', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('clicking a link item navigates and closes modal', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    const {router} = render(<GlobalActionsComponent actions={globalActions} />);
    await userEvent.click(await screen.findByRole('option', {name: 'Go to route'}));

    await waitFor(() => expect(router.location.pathname).toBe('/target/'));
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('ArrowDown to a link item then Enter navigates and closes modal', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    const {router} = render(<GlobalActionsComponent actions={globalActions} />);
    await screen.findByRole('textbox', {name: 'Search commands'});
    // First item should already be highlighted, arrow down will go highlight "other"
    await userEvent.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => expect(router.location.pathname).toBe('/other/'));
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking action with children shows sub-items, backspace returns', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    render(<GlobalActionsComponent actions={globalActions} />);

    // Open children
    await userEvent.click(await screen.findByRole('option', {name: 'Parent action'}));

    // Textbox changes placeholder to parent action label
    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Search commands'})).toHaveAttribute(
        'placeholder',
        'Parent action'
      );
    });

    // Child actions are visible, global actions are not
    expect(screen.getByRole('option', {name: 'Child action'})).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Parent action'})).not.toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Go to route'})).not.toBeInTheDocument();

    // Hit Backspace on the input to go back
    await userEvent.keyboard('{Backspace}');

    // Back to main actions
    expect(
      await screen.findByRole('option', {name: 'Parent action'})
    ).toBeInTheDocument();
    expect(screen.queryByRole('option', {name: 'Child action'})).not.toBeInTheDocument();

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it('clicking child sub-item runs onAction and closes modal', async () => {
    const closeSpy = jest.spyOn(modalActions, 'closeModal');
    render(<GlobalActionsComponent actions={globalActions} />);
    await userEvent.click(await screen.findByRole('option', {name: 'Parent action'}));
    await userEvent.click(await screen.findByRole('option', {name: 'Child action'}));

    expect(onChild).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  describe('search', () => {
    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('typing a query filters results to matching items only', async () => {
      // Type "route" and expect "Go to route" to be visible but "Other" and "Parent action" to be hidden
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('non-matching items are not shown', async () => {
      // Type a query that matches nothing and expect no options to be in the document
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('clearing the query restores all top-level items', async () => {
      // Type a query, then clear it — all top-level actions should reappear
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('child actions are hidden when query is empty', async () => {
      // Without typing anything, child actions of group actions should not be visible
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('child actions are directly searchable without drilling into the group', async () => {
      // Type "child" and expect "Parent action → Child action" to appear in the flat results
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('search is case-insensitive', async () => {
      // Type "ROUTE" (uppercase) and expect "Go to route" to still match
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('actions are ranked by match quality — better matches appear first', async () => {
      // Given actions where one label starts with the query and another contains it later,
      // the one with the earlier / stronger match should rank first
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('top-level actions rank before child actions when both match the query', async () => {
      // Given a query that matches both a top-level action label and a child action label,
      // the top-level action should appear before the child action in the results
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip('actions with matching keywords are included in results', async () => {
      // Register an action whose label does not contain the query but whose keywords[] do,
      // and expect it to appear in the filtered results
    });

    // eslint-disable-next-line jest/no-disabled-tests
    it.skip("searching within a drilled-in group filters that group's children", async () => {
      // Drill into a group, then type a query — only matching children should be visible
    });
  });
});
