import {render, screen} from 'sentry-test/reactTestingLibrary';

import localStorage from 'sentry/utils/localStorage';

import ReplayInlineOnboardingPanel from './replayInlineOnboardingPanel';

jest.mock('sentry/utils/localStorage');

const OFFSET = 1000 * 60 * 60 * 24 * 7;

describe('replayInlineOnboardingPanel', () => {
  it('should render by default', async () => {
    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      await screen.findByText('Watch the errors and latency issues your users face')
    ).toBeInTheDocument();
  });

  it('should not render if hideUntil is set', async () => {
    localStorage.getItem = jest.fn().mockReturnValue(Date.now() + OFFSET);
    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      await screen.queryByText('Watch the errors and latency issues your users face')
    ).not.toBeInTheDocument();
  });

  it('should clear the hideUntil time if it has expired', async () => {
    localStorage.getItem = jest.fn().mockReturnValue(Date.now() - OFFSET);
    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      await screen.findByText('Watch the errors and latency issues your users face')
    ).toBeInTheDocument();
  });
});
