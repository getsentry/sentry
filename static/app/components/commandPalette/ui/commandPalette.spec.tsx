import {useCallback} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {commandPaletteSearch} from 'sentry/components/commandPalette/ui/commandPalette';

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

// import {closeModal} from 'sentry/actionCreators/modal';
// import * as modalActions from 'sentry/actionCreators/modal';
// import {CommandPaletteProvider} from 'sentry/components/commandPalette/context';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import type {CommandPaletteActionWithKey} from 'sentry/components/commandPalette/types';
// import {CommandPalette} from 'sentry/components/commandPalette/ui/commandPalette';
// import {useCommandPaletteActions} from 'sentry/components/commandPalette/useCommandPaletteActions';
// import {useNavigate} from 'sentry/utils/useNavigate';

// function RegisterActions({actions}: {actions: CommandPaletteAction[]}) {
//   useCommandPaletteActions(actions);
//   return null;
// }

// function GlobalActionsComponent({
//   actions,
//   children,
// }: {
//   actions: CommandPaletteAction[];
//   children?: React.ReactNode;
// }) {
//   const navigate = useNavigate();

//   const handleAction = useCallback(
//     (action: Exclude<CommandPaletteActionWithKey, {type: 'group'}>) => {
//       if (action.type === 'navigate') {
//         navigate(action.to);
//       } else {
//         action.onAction();
//       }
//       closeModal();
//     },
//     [navigate]
//   );

//   return (
//     <CommandPaletteProvider>
//       <RegisterActions actions={actions} />
//       <CommandPalette onAction={handleAction} />
//       {children}
//     </CommandPaletteProvider>
//   );
// }

// const onChild = jest.fn();

// const globalActions: CommandPaletteAction[] = [
//   {
//     to: '/target/',
//     groupingKey: 'navigate',
//     display: {
//       label: 'Go to route',
//     },
//     type: 'navigate',
//   },
//   {
//     to: '/other/',
//     groupingKey: 'help',
//     display: {label: 'Other'},
//     type: 'navigate',
//   },
//   {
//     groupingKey: 'add',
//     display: {label: 'Parent action'},
//     actions: [
//       {
//         onAction: onChild,
//         display: {label: 'Child action'},
//         type: 'callback',
//       },
//     ],
//     type: 'group',
//   },
// ];

// describe('CommandPalette', () => {
//   beforeEach(() => {
//     jest.resetAllMocks();
//   });

//   it('clicking a link item navigates and closes modal', async () => {
//     const closeSpy = jest.spyOn(modalActions, 'closeModal');
//     const {router} = render(<GlobalActionsComponent actions={globalActions} />);
//     await userEvent.click(await screen.findByRole('option', {name: 'Go to route'}));

//     await waitFor(() => expect(router.location.pathname).toBe('/target/'));
//     expect(closeSpy).toHaveBeenCalledTimes(1);
//   });

//   it('ArrowDown to a link item then Enter navigates and closes modal', async () => {
//     const closeSpy = jest.spyOn(modalActions, 'closeModal');
//     const {router} = render(<GlobalActionsComponent actions={globalActions} />);
//     await screen.findByRole('textbox', {name: 'Search commands'});
//     // First item should already be highlighted, arrow down will go highlight "other"
//     await userEvent.keyboard('{ArrowDown}{Enter}');

//     await waitFor(() => expect(router.location.pathname).toBe('/other/'));
//     expect(closeSpy).toHaveBeenCalledTimes(1);
//   });

//   it('clicking action with children shows sub-items, backspace returns', async () => {
//     const closeSpy = jest.spyOn(modalActions, 'closeModal');
//     render(<GlobalActionsComponent actions={globalActions} />);

//     // Open children
//     await userEvent.click(await screen.findByRole('option', {name: 'Parent action'}));

//     // Textbox changes placeholder to parent action label
//     await waitFor(() => {
//       expect(screen.getByRole('textbox', {name: 'Search commands'})).toHaveAttribute(
//         'placeholder',
//         'Search inside Parent action...'
//       );
//     });

//     // Child actions are visible, global actions are not
//     expect(screen.getByRole('option', {name: 'Child action'})).toBeInTheDocument();
//     expect(screen.queryByRole('option', {name: 'Parent action'})).not.toBeInTheDocument();
//     expect(screen.queryByRole('option', {name: 'Go to route'})).not.toBeInTheDocument();

//     // Hit Backspace on the input to go back
//     await userEvent.keyboard('{Backspace}');

//     // Back to main actions
//     expect(
//       await screen.findByRole('option', {name: 'Parent action'})
//     ).toBeInTheDocument();
//     expect(screen.queryByRole('option', {name: 'Child action'})).not.toBeInTheDocument();

//     expect(closeSpy).not.toHaveBeenCalled();
//   });

//   it('clicking child sub-item runs onAction and closes modal', async () => {
//     const closeSpy = jest.spyOn(modalActions, 'closeModal');
//     render(<GlobalActionsComponent actions={globalActions} />);
//     await userEvent.click(await screen.findByRole('option', {name: 'Parent action'}));
//     await userEvent.click(await screen.findByRole('option', {name: 'Child action'}));

//     expect(onChild).toHaveBeenCalled();
//     expect(closeSpy).toHaveBeenCalledTimes(1);
//   });

//   describe('search', () => {
//     it('typing a query filters results to matching items only', async () => {
//       render(<GlobalActionsComponent actions={globalActions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});
//       await userEvent.type(input, 'route');

//       expect(
//         await screen.findByRole('option', {name: 'Go to route'})
//       ).toBeInTheDocument();
//       expect(screen.queryByRole('option', {name: 'Other'})).not.toBeInTheDocument();
//       expect(
//         screen.queryByRole('option', {name: 'Parent action'})
//       ).not.toBeInTheDocument();
//     });

//     it('non-matching items are not shown', async () => {
//       render(<GlobalActionsComponent actions={globalActions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});
//       await userEvent.type(input, 'xyzzy');

//       expect(screen.queryAllByRole('option')).toHaveLength(0);
//     });

//     it('clearing the query restores all top-level items', async () => {
//       render(<GlobalActionsComponent actions={globalActions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});
//       await userEvent.type(input, 'route');
//       expect(
//         await screen.findByRole('option', {name: 'Go to route'})
//       ).toBeInTheDocument();

//       await userEvent.clear(input);

//       expect(
//         await screen.findByRole('option', {name: 'Go to route'})
//       ).toBeInTheDocument();
//       expect(screen.getByRole('option', {name: 'Other'})).toBeInTheDocument();
//       expect(screen.getByRole('option', {name: 'Parent action'})).toBeInTheDocument();
//     });

//     it('child actions are hidden when query is empty', async () => {
//       render(<GlobalActionsComponent actions={globalActions} />);
//       await screen.findByRole('option', {name: 'Parent action'});

//       expect(
//         screen.queryByRole('option', {name: 'Child action'})
//       ).not.toBeInTheDocument();
//     });

//     it('child actions are directly searchable without drilling into the group', async () => {
//       render(<GlobalActionsComponent actions={globalActions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});
//       await userEvent.type(input, 'child');

//       expect(
//         await screen.findByRole('option', {name: 'Parent action → Child action'})
//       ).toBeInTheDocument();
//     });

//     it('search is case-insensitive', async () => {
//       render(<GlobalActionsComponent actions={globalActions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});
//       await userEvent.type(input, 'ROUTE');

//       expect(
//         await screen.findByRole('option', {name: 'Go to route'})
//       ).toBeInTheDocument();
//     });

//     it('actions are ranked by match quality — better matches appear first', async () => {
//       const actions: CommandPaletteAction[] = [
//         {
//           type: 'navigate',
//           to: '/a/',
//           display: {label: 'Something with issues buried'},
//           groupingKey: 'navigate',
//         },
//         {
//           type: 'navigate',
//           to: '/b/',
//           display: {label: 'Issues'},
//           groupingKey: 'navigate',
//         },
//       ];
//       render(<GlobalActionsComponent actions={actions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});
//       await userEvent.type(input, 'issues');

//       const options = (await screen.findAllByRole('option')).filter(
//         el => !el.hasAttribute('aria-disabled')
//       );
//       expect(options[0]).toHaveAccessibleName('Issues');
//       expect(options[1]).toHaveAccessibleName('Something with issues buried');
//     });

//     it('top-level actions rank before child actions when both match the query', async () => {
//       const actions: CommandPaletteAction[] = [
//         {
//           type: 'group',
//           display: {label: 'Group'},
//           groupingKey: 'navigate',
//           actions: [{type: 'navigate', to: '/child/', display: {label: 'Issues child'}}],
//         },
//         {
//           type: 'navigate',
//           to: '/top/',
//           display: {label: 'Issues'},
//           groupingKey: 'navigate',
//         },
//       ];
//       render(<GlobalActionsComponent actions={actions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});
//       await userEvent.type(input, 'issues');

//       const options = (await screen.findAllByRole('option')).filter(
//         el => !el.hasAttribute('aria-disabled')
//       );
//       expect(options[0]).toHaveAccessibleName('Issues');
//       expect(options[1]).toHaveAccessibleName('Group → Issues child');
//     });

//     it('actions with matching keywords are included in results', async () => {
//       const actions: CommandPaletteAction[] = [
//         {
//           type: 'navigate',
//           to: '/shortcuts/',
//           display: {label: 'Keyboard shortcuts'},
//           keywords: ['hotkeys', 'keybindings'],
//           groupingKey: 'help',
//         },
//       ];
//       render(<GlobalActionsComponent actions={actions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});
//       await userEvent.type(input, 'hotkeys');

//       expect(
//         await screen.findByRole('option', {name: 'Keyboard shortcuts'})
//       ).toBeInTheDocument();
//     });

//     it("searching within a drilled-in group filters that group's children", async () => {
//       const actions: CommandPaletteAction[] = [
//         {
//           type: 'group',
//           display: {label: 'Theme'},
//           groupingKey: 'navigate',
//           actions: [
//             {type: 'callback', onAction: jest.fn(), display: {label: 'Light'}},
//             {type: 'callback', onAction: jest.fn(), display: {label: 'Dark'}},
//           ],
//         },
//       ];
//       render(<GlobalActionsComponent actions={actions} />);

//       // Drill into the group
//       await userEvent.click(await screen.findByRole('option', {name: 'Theme'}));
//       await screen.findByRole('option', {name: 'Light'});

//       // Now type a query that only matches one child
//       const input = screen.getByRole('textbox', {name: 'Search commands'});
//       await userEvent.type(input, 'dark');

//       expect(await screen.findByRole('option', {name: 'Dark'})).toBeInTheDocument();
//       expect(screen.queryByRole('option', {name: 'Light'})).not.toBeInTheDocument();
//     });
//   });

//   describe('query restoration', () => {
//     it('drilling into a group clears the active query', async () => {
//       render(<GlobalActionsComponent actions={globalActions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});

//       // Type a query that shows the group in search results
//       await userEvent.type(input, 'parent');
//       await screen.findByRole('option', {name: 'Parent action'});

//       // Drill into the group by clicking the group item itself — input should be cleared
//       await userEvent.click(screen.getByRole('option', {name: 'Parent action'}));

//       await waitFor(() => expect(input).toHaveValue(''));
//     });

//     it('Backspace from a drilled group restores the query that was active before drilling in', async () => {
//       render(<GlobalActionsComponent actions={globalActions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});

//       // Type a query, then drill into the group that appears in search results
//       await userEvent.type(input, 'parent');
//       await userEvent.click(await screen.findByRole('option', {name: 'Parent action'}));
//       await screen.findByRole('option', {name: 'Child action'});

//       // Go back with Backspace — the pre-drill query should be restored
//       await userEvent.keyboard('{Backspace}');

//       await waitFor(() => expect(input).toHaveValue('parent'));
//     });

//     it('clicking the back button from a drilled group restores the query that was active before drilling in', async () => {
//       render(<GlobalActionsComponent actions={globalActions} />);
//       const input = await screen.findByRole('textbox', {name: 'Search commands'});

//       // Type a query, then drill into the group that appears in search results
//       await userEvent.type(input, 'parent');
//       await userEvent.click(await screen.findByRole('option', {name: 'Parent action'}));
//       await screen.findByRole('option', {name: 'Child action'});

//       // Go back with the back button — the pre-drill query should be restored
//       await userEvent.click(
//         screen.getByRole('button', {name: 'Return to previous action'})
//       );

//       await waitFor(() => expect(input).toHaveValue('parent'));
//     });
//   });
// });

function traverse(action: CommandPaletteActionWithKey, results: string[], depth: number) {
  for (const child of action.children) {
    traverse(child, results, depth + 1);
  }
  results.push(' '.repeat(depth) + serializeAction(action));
}

function serializeAction(action: CommandPaletteActionWithKey) {
  if (action.type === 'section') {
    return `section:${action.label as string}`;
  }
  return action.label as string;
}

function serialize(actions: ReturnType<typeof commandPaletteSearch>) {
  const results: string[] = [];
  for (const action of actions) {
    traverse(action, results, 0);
  }
  return results.join('\n');
}

describe('commandPaletteSearch', () => {
  it('no query returns initial state', () => {
    const actions: CommandPaletteActionWithKey[] = [
      {
        key: 'a',
        type: 'navigate',
        to: '/a/',
        display: {label: 'A'},
        groupingKey: 'navigate',
      },
      {
        key: 'b',
        type: 'navigate',
        to: '/b/',
        display: {label: 'B'},
        groupingKey: 'navigate',
      },
    ];

    const result = commandPaletteSearch('', actions);
    expect(result).toHaveLength(2);
    expect(serialize(result)).toBe(
      `
 section:navigate
  A
  B
`
    );
  });
});
