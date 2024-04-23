import {render, screen} from 'sentry-test/reactTestingLibrary';

import {usePrompt as usePromptImport} from 'sentry/actionCreators/prompts';

import ReplayInlineOnboardingPanel from './replayInlineOnboardingPanel';

jest.mock('sentry/actionCreators/prompts');
const usePrompt = jest.mocked(usePromptImport);

describe('replayInlineOnboardingPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePrompt.mockClear();
  });

  it('should render if not dismissed', async () => {
    const dismissPrompt = jest.fn();
    const snoozePrompt = jest.fn();
    usePrompt.mockImplementation(() => {
      return {
        isPromptDismissed: false,
        isLoading: false,
        isError: false,
        snoozePrompt,
        dismissPrompt,
      };
    });
    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      await screen.findByText('Watch the errors and latency issues your users face')
    ).toBeInTheDocument();
  });

  it('should not render if dismissed', async () => {
    const dismissPrompt = jest.fn();
    const snoozePrompt = jest.fn();
    usePrompt.mockImplementation(() => {
      return {
        isPromptDismissed: true,
        isLoading: false,
        isError: false,
        snoozePrompt,
        dismissPrompt,
      };
    });
    render(<ReplayInlineOnboardingPanel platform="react" projectId="123" />);
    expect(
      await screen.queryByText('Watch the errors and latency issues your users face')
    ).not.toBeInTheDocument();
  });
});
