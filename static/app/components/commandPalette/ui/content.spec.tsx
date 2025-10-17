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
    key: 'go-to-route',
    to: '/target/',
    groupingKey: 'navigate',
    display: {
      label: 'Go to route',
    },
  },
  {
    key: 'other',
    to: '/other/',
    groupingKey: 'help',
    display: {label: 'Other'},
  },
  {
    key: 'parent-action',
    groupingKey: 'add',
    display: {label: 'Parent action'},
    actions: [{onAction: onChild, key: 'child-action', display: {label: 'Child action'}}],
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
});
