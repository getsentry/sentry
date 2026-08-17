import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {KeyboardShortcutsDrawer} from './keyboardShortcutsDrawer';

describe('KeyboardShortcutsDrawer', () => {
  it('shows grouped shortcuts', () => {
    render(<KeyboardShortcutsDrawer />);

    expect(screen.getByRole('heading', {name: 'General'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Command Palette'})).toBeInTheDocument();
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
