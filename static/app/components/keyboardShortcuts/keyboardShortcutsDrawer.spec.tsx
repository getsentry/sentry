import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {KeyboardShortcutsDrawer} from './keyboardShortcutsDrawer';
import {KeyboardShortcutsHotkeys} from './useKeyboardShortcutsDrawer';

describe('KeyboardShortcutsDrawer', () => {
  it('toggles from the global shortcut', async () => {
    render(<KeyboardShortcutsHotkeys />);

    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');

    expect(
      await screen.findByRole('heading', {name: 'Keyboard Shortcuts'})
    ).toBeInTheDocument();

    await userEvent.keyboard('{Control>}{Shift>}{Enter}{/Shift}{/Control}');

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {name: 'Keyboard Shortcuts'})
      ).not.toBeInTheDocument();
    });
  });

  it('shows grouped shortcuts', () => {
    render(<KeyboardShortcutsDrawer />);

    expect(screen.getByRole('heading', {name: 'General'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Navigation'})).toBeInTheDocument();
    expect(screen.getByText('Open command palette')).toBeInTheDocument();
    expect(screen.getByText('Select command')).toBeInTheDocument();
  });

  it('filters shortcuts by label and category', async () => {
    render(<KeyboardShortcutsDrawer />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search keyboard shortcuts'}),
      'new tab'
    );

    expect(screen.getByText('Open link in new tab')).toBeInTheDocument();
    expect(screen.queryByText('Open command palette')).not.toBeInTheDocument();
  });

  it('shows an empty state when no shortcuts match', async () => {
    render(<KeyboardShortcutsDrawer />);

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Search keyboard shortcuts'}),
      'not a shortcut'
    );

    expect(screen.getByText('No shortcuts found')).toBeInTheDocument();
  });
});
