import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SetupReplaysCTA} from 'sentry/views/replays/list/replayOnboardingPanel';

describe('SetupReplaysCTA', () => {
  it('renders setup replay', () => {
    render(<SetupReplaysCTA primaryAction="setup" />);
    expect(screen.getByTestId('setup-replays-btn')).toBeInTheDocument();
  });

  it('renders setup replay w/ disabled state including tooltip', async () => {
    render(<SetupReplaysCTA primaryAction="setup" disabled />);
    const setupBtn = screen.getByTestId('setup-replays-btn');
    await userEvent.hover(setupBtn);
    await screen.findByTestId('setup-replays-tooltip');
    expect(screen.getByTestId('setup-replays-tooltip')).toBeInTheDocument();
  });

  it('create project', () => {
    render(<SetupReplaysCTA primaryAction="create" />);
    const createBtn = screen.getByTestId('create-project-btn');
    expect(createBtn).toBeInTheDocument();
    expect(createBtn).toHaveAttribute(
      'href',
      `/organizations/org-slug/insights/projects/new/`
    );
  });

  it('create project w/ disabled state including tooltip', async () => {
    render(<SetupReplaysCTA primaryAction="create" disabled />);
    const createBtn = screen.getByTestId('create-project-btn');
    await userEvent.hover(createBtn);
    await screen.findByTestId('create-project-tooltip');
    expect(screen.getByTestId('create-project-tooltip')).toBeInTheDocument();
  });
});
