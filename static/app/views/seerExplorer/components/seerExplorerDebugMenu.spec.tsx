import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {SeerExplorerDebugMenu} from './seerExplorerDebugMenu';

function defaultProps(
  overrides: Partial<React.ComponentProps<typeof SeerExplorerDebugMenu>> = {}
) {
  return {
    overrideBashModeEnabled: false,
    onOverrideBashModeToggle: jest.fn(),
    ...overrides,
  };
}

describe('SeerExplorerDebugMenu', () => {
  beforeEach(() => {
    ConfigStore.set(
      'user',
      UserFixture({
        emails: [{email: 'employee@sentry.io', is_verified: true, id: '1'}],
      })
    );
  });

  it('renders the force bash mode toggle', async () => {
    render(<SeerExplorerDebugMenu {...defaultProps()} />);

    await userEvent.click(screen.getByRole('button', {name: 'Seer settings'}));

    expect(screen.getByRole('listbox', {name: 'Debug'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: /Force bash mode on/})).toBeInTheDocument();
    expect(
      screen.queryByRole('option', {name: 'Open agent trace'})
    ).not.toBeInTheDocument();
  });

  it('renders nothing for non-employees', () => {
    ConfigStore.set('user', UserFixture());
    const {container} = render(<SeerExplorerDebugMenu {...defaultProps()} />);

    expect(screen.queryByRole('button', {name: 'Seer settings'})).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('toggles force bash mode', async () => {
    const onOverrideBashModeToggle = jest.fn();
    render(
      <SeerExplorerDebugMenu
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
    render(<SeerExplorerDebugMenu {...defaultProps({conversationsUrl})} />);

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
      <SeerExplorerDebugMenu
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
      <SeerExplorerDebugMenu
        {...defaultProps({
          conversationsUrl:
            'https://sentry.io/organizations/org-slug/explore/conversations/run-id/',
        })}
      />
    );

    expect(screen.queryByRole('button', {name: 'Seer settings'})).not.toBeInTheDocument();
  });
});
