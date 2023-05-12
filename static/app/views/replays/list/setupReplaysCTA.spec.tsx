import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SetupReplaysCTA} from 'sentry/views/replays/list/replayOnboardingPanel';

describe('SetupReplaysCTA', () => {
  it('renders setup replay', () => {
    render(<SetupReplaysCTA primaryAction="setup" orgSlug="foo" />);
    expect(screen.getByTestId('setup-replays-btn')).toBeInTheDocument();
  });

  it('renders setup replay w/ disabled state including tooltip', async () => {
    render(<SetupReplaysCTA primaryAction="setup" orgSlug="foo" disabled />);
    const setupBtn = screen.getByTestId('setup-replays-btn');
    await userEvent.hover(setupBtn);
    await waitFor(() => screen.getByTestId('setup-replays-tooltip'));
    expect(screen.getByTestId('setup-replays-tooltip')).toBeInTheDocument();
  });

  it('create project', () => {
    render(<SetupReplaysCTA primaryAction="create" orgSlug="foo" />);
    const createBtn = screen.getByTestId('create-project-btn');
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveAttribute('href', `/organizations/foo/projects/new/`);
  });

  it('create project w/ disabled state including tooltip', async () => {
    render(<SetupReplaysCTA primaryAction="create" orgSlug="foo" disabled />);
    const createBtn = screen.getByTestId('create-project-btn');
    await userEvent.hover(createBtn);
    await waitFor(() => screen.getByTestId('create-project-tooltip'));
    expect(screen.getByTestId('create-project-tooltip')).toBeInTheDocument();
  });
});
