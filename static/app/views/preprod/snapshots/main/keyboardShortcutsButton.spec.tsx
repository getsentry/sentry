import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import {KeyboardShortcutsButton} from './keyboardShortcutsButton';

jest.mock('sentry/utils/analytics');

describe('KeyboardShortcutsButton', () => {
  const organization = OrganizationFixture();

  it('shows the shortcuts in a tooltip on hover', async () => {
    render(<KeyboardShortcutsButton />, {organization});

    await userEvent.hover(screen.getByRole('button', {name: 'Keyboard shortcuts'}));

    expect(await screen.findByText('List view')).toBeInTheDocument();
    expect(screen.getByText('Open selected snapshot')).toBeInTheDocument();
    expect(screen.getByText('Pan a zoomed image')).toBeInTheDocument();
  });

  it('opens a modal with the shortcuts on click', async () => {
    render(<KeyboardShortcutsButton />, {organization});
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Keyboard shortcuts'}));

    const dialog = await screen.findByRole('dialog');
    expect(screen.getByRole('heading', {name: 'Keyboard shortcuts'})).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Next image');
    expect(dialog).toHaveTextContent('Zoom in list and split views');
    expect(trackAnalytics).toHaveBeenCalledWith(
      'preprod.snapshots.details.keyboard_shortcuts_opened',
      {organization}
    );
  });
});
