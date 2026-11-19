import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {SeerExplorerSettingsMenu} from './seerExplorerSettingsMenu';

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof SeerExplorerSettingsMenu>> = {}
) {
  return {
    isPipSupported: false,
    isPoppedOut: false,
    onTogglePictureInPicture: jest.fn(),
    overrideBashModeEnabled: false,
    onOverrideBashModeToggle: jest.fn(),
    ...overrides,
  };
}

describe('SeerExplorerSettingsMenu', () => {
  beforeEach(() => {
    ConfigStore.set(
      'user',
      UserFixture({
        emails: [{email: 'employee@sentry.io', is_verified: true, id: '1'}],
      })
    );
  });

  it('renders the force bash mode toggle', async () => {
    render(<SeerExplorerSettingsMenu {...defaultProps()} />);

    await userEvent.click(screen.getByRole('button', {name: 'Seer settings'}));

    expect(screen.getByRole('listbox', {name: 'Debug'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Force bash mode on/})).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {name: 'Open agent trace'})
    ).not.toBeInTheDocument();
  });

  it('renders nothing for non-employees', () => {
    ConfigStore.set('user', UserFixture());
    const {container} = render(<SeerExplorerSettingsMenu {...defaultProps()} />);

    expect(screen.queryByRole('button', {name: 'Seer settings'})).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('toggles force bash mode', async () => {
    const onOverrideBashModeToggle = jest.fn();
    render(
      <SeerExplorerSettingsMenu
        {...defaultProps({overrideBashModeEnabled: true, onOverrideBashModeToggle})}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Seer settings'}));

    expect(screen.getByRole('option', {name: /Force bash mode on/})).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await userEvent.click(screen.getByRole('option', {name: /Force bash mode on/}));
    expect(onOverrideBashModeToggle).toHaveBeenCalled();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('renders the agent trace link alongside the toggles', async () => {
    const conversationsUrl =
      'https://sentry.io/organizations/org-slug/explore/conversations/run-id/';
    render(<SeerExplorerSettingsMenu {...defaultProps({conversationsUrl})} />);

    await userEvent.click(screen.getByRole('button', {name: 'Seer settings'}));

    expect(screen.getByRole('option', {name: /Force bash mode on/})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: 'Open agent trace'})).toBeInTheDocument();
  });

  it('opens the agent trace in a new tab without toggling anything', async () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => null);
    const onOverrideBashModeToggle = jest.fn();
    const conversationsUrl =
      'https://sentry.io/organizations/org-slug/explore/conversations/run-id/';
    render(
      <SeerExplorerSettingsMenu
        {...defaultProps({conversationsUrl, onOverrideBashModeToggle})}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Seer settings'}));
    await userEvent.click(screen.getByRole('option', {name: 'Open agent trace'}));

    expect(openSpy).toHaveBeenCalledWith(
      conversationsUrl,
      '_blank',
      'noopener,noreferrer'
    );
    expect(onOverrideBashModeToggle).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    openSpy.mockRestore();
  });

  it('does not render the agent trace link for non-employees', () => {
    ConfigStore.set('user', UserFixture());
    render(
      <SeerExplorerSettingsMenu
        {...defaultProps({
          conversationsUrl:
            'https://sentry.io/organizations/org-slug/explore/conversations/run-id/',
        })}
      />
    );

    expect(screen.queryByRole('button', {name: 'Seer settings'})).not.toBeInTheDocument();
  });

  describe('Dock position', () => {
    beforeEach(() => {
      ConfigStore.set('user', UserFixture());
    });

    it('shows the dock position to non-employees', async () => {
      render(
        <SeerExplorerSettingsMenu
          {...defaultProps({
            sidebarPosition: 'bottom',
            onSidebarPositionChange: jest.fn(),
          })}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Seer settings'}));

      expect(screen.getByRole('option', {name: 'Bottom'})).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(screen.queryByRole('option', {name: 'Windowed'})).not.toBeInTheDocument();
      expect(
        screen.queryByRole('option', {name: /Force bash mode on/})
      ).not.toBeInTheDocument();
    });

    it('changes the dock position', async () => {
      const onSidebarPositionChange = jest.fn();
      render(<SeerExplorerSettingsMenu {...defaultProps({onSidebarPositionChange})} />);

      await userEvent.click(screen.getByRole('button', {name: 'Seer settings'}));
      await userEvent.click(screen.getByRole('option', {name: 'Right'}));

      expect(onSidebarPositionChange).toHaveBeenCalledWith('right');
    });

    it('pops Seer out from the Windowed option', async () => {
      const onSidebarPositionChange = jest.fn();
      const onTogglePictureInPicture = jest.fn();
      render(
        <SeerExplorerSettingsMenu
          {...defaultProps({
            isPipSupported: true,
            onSidebarPositionChange,
            onTogglePictureInPicture,
          })}
        />
      );

      await userEvent.click(screen.getByRole('button', {name: 'Seer settings'}));
      await userEvent.click(screen.getByRole('option', {name: 'Windowed'}));

      expect(onTogglePictureInPicture).toHaveBeenCalledTimes(1);
      expect(onSidebarPositionChange).not.toHaveBeenCalled();
    });

    it('renders nothing for non-employees once popped out', () => {
      const {container} = render(
        <SeerExplorerSettingsMenu
          {...defaultProps({isPoppedOut: true, onSidebarPositionChange: jest.fn()})}
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });
});
