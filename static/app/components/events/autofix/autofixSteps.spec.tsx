import {AutofixCodebaseChangeData} from 'sentry-fixture/autofixCodebaseChangeData';
import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixProgressItemFixture} from 'sentry-fixture/autofixProgressItem';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {
  AutofixStatus,
  type AutofixStep,
  AutofixStepType,
} from 'sentry/components/events/autofix/types';

jest.mock('sentry/actionCreators/indicator');

describe('AutofixSteps', () => {
  beforeEach(() => {
    (addSuccessMessage as jest.Mock).mockClear();
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  const defaultProps = {
    data: AutofixDataFixture({
      steps: [
        AutofixStepFixture({
          id: '1',
          type: AutofixStepType.DEFAULT,
          status: AutofixStatus.COMPLETED,
          insights: [],
          progress: [],
        }),
        AutofixStepFixture({
          id: '2',
          type: AutofixStepType.ROOT_CAUSE_ANALYSIS,
          status: AutofixStatus.COMPLETED,
          causes: [
            {
              id: 'cause1',
              description: 'Root cause 1',
              title: 'cause 1',
              code_context: [],
            },
          ],
          selection: null,
          progress: [],
        }),
      ],
      repositories: [],
      created_at: '2023-01-01T00:00:00Z',
      run_id: '1',
      status: AutofixStatus.PROCESSING,
    }),
    groupId: 'group1',
    runId: 'run1',
    onRetry: jest.fn(),
  };

  it('renders steps correctly', () => {
    render(<AutofixSteps {...defaultProps} />);

    expect(screen.getByText('Root cause 1')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('(Optional) Provide any instructions for the fix...')
    ).toBeInTheDocument();
  });

  it('handles root cause selection', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/group1/autofix/update/',
      method: 'POST',
      body: {},
    });

    render(<AutofixSteps {...defaultProps} />);

    const input = screen.getByPlaceholderText(
      '(Optional) Provide any instructions for the fix...'
    );
    await userEvent.type(input, 'Custom root cause');
    await userEvent.click(screen.getByRole('button', {name: 'Find a Fix'}));

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith(
        "Great, let's move forward with this root cause."
      );
    });
  });

  it('selects default root cause when input is empty', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/group1/autofix/update/',
      method: 'POST',
      body: {},
    });

    render(<AutofixSteps {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Find a Fix'}));

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith(
        "Great, let's move forward with this root cause."
      );
    });
  });

  it('renders AutofixMessageBox with correct props', () => {
    render(<AutofixSteps {...defaultProps} />);

    const messageBox = screen.getByPlaceholderText(
      '(Optional) Provide any instructions for the fix...'
    );
    expect(messageBox).toBeInTheDocument();

    const sendButton = screen.getByRole('button', {name: 'Find a Fix'});
    expect(sendButton).toBeInTheDocument();
    expect(sendButton).toBeEnabled();
  });

  it('updates message box based on last step', () => {
    const propsWithProgress = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        steps: [
          ...(defaultProps.data.steps as AutofixStep[]),
          AutofixStepFixture({
            id: '3',
            type: AutofixStepType.DEFAULT,
            status: AutofixStatus.PROCESSING,
            progress: [
              AutofixProgressItemFixture({
                message: 'Log message',
                timestamp: '2023-01-01T00:00:00Z',
              }),
            ],
            insights: [],
          }),
        ],
      },
    };

    render(<AutofixSteps {...propsWithProgress} />);

    expect(screen.getByText('Log message')).toBeInTheDocument();
  });

  it('handles iterating on changes step', async () => {
    MockApiClient.addMockResponse({
      url: '/issues/group1/autofix/setup/',
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          repos: [],
        },
      },
    });
    MockApiClient.addMockResponse({
      url: '/issues/group1/autofix/update/',
      method: 'POST',
      body: {},
    });

    const changeData = AutofixCodebaseChangeData();
    changeData.pull_request = undefined;

    const propsWithChanges = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        steps: [
          AutofixStepFixture({
            id: '1',
            type: AutofixStepType.DEFAULT,
            status: AutofixStatus.COMPLETED,
            insights: [],
            progress: [],
            index: 0,
          }),
          AutofixStepFixture({
            id: '2',
            type: AutofixStepType.CHANGES,
            status: AutofixStatus.COMPLETED,
            progress: [],
            changes: [changeData],
          }),
        ],
      },
    };

    render(<AutofixSteps {...propsWithChanges} />);

    const input = screen.getByPlaceholderText('Share helpful context or feedback...');
    await userEvent.type(input, 'Feedback on changes');
    await userEvent.click(screen.getByRole('button', {name: 'Send'}));

    await waitFor(() => {
      expect(addSuccessMessage).toHaveBeenCalledWith('Thanks, rethinking this...');
    });
  });
});
