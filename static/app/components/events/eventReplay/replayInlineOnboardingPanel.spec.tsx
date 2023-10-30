import {render, screen} from 'sentry-test/reactTestingLibrary';

import localStorage from 'sentry/utils/localStorage';

import ReplayInlineOnboardingPanel from './replayInlineOnboardingPanel';

jest.mock('sentry/utils/localStorage');

const TEN_SECONDS = 10 * 1000;

describe('replayInlineOnboardingPanel', () => {
  it('should render by default', async () => {
    render(<ReplayInlineOnboardingPanel />);
    expect(await screen.findByText('Configure Session Replay')).toBeInTheDocument();
  });

  it('should not render if hideUntil is set', async () => {
    localStorage.getItem = jest.fn().mockReturnValue(Date.now() + TEN_SECONDS);
    render(<ReplayInlineOnboardingPanel />);
    expect(await screen.queryByText('Configure Session Replay')).not.toBeInTheDocument();
  });

  it('should clear the hideUntil time if it has expired', async () => {
    localStorage.getItem = jest.fn().mockReturnValue(Date.now() - TEN_SECONDS);
    render(<ReplayInlineOnboardingPanel />);
    expect(await screen.findByText('Configure Session Replay')).toBeInTheDocument();
  });
});
