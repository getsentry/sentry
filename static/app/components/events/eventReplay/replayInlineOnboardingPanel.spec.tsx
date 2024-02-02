import {render, screen} from 'sentry-test/reactTestingLibrary';

import useDismissAlertImport from 'sentry/utils/useDismissAlert';

import ReplayInlineOnboardingPanel from './replayInlineOnboardingPanel';

jest.mock('sentry/utils/localStorage');
jest.mock('sentry/utils/useDismissAlert');
const useDismissAlert = jest.mocked(useDismissAlertImport);

describe('replayInlineOnboardingPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useDismissAlert.mockClear();
  });

  it('should render if not dismissed', async () => {
    const dismiss = jest.fn();
    useDismissAlert.mockImplementation(() => {
      return {
        dismiss,
        isDismissed: false,
      };
    });
    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      await screen.findByText('Watch the errors and latency issues your users face')
    ).toBeInTheDocument();
  });

  it('should not render if dismissed', async () => {
    const dismiss = jest.fn();
    useDismissAlert.mockImplementation(() => {
      return {
        dismiss,
        isDismissed: true,
      };
    });
    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      await screen.queryByText('Watch the errors and latency issues your users face')
    ).not.toBeInTheDocument();
  });
});
