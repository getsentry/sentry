import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixProgressItemFixture} from 'sentry-fixture/autofixProgressItem';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {AutofixStatus, AutofixStepType} from 'sentry/components/events/autofix/types';

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
          index: 0,
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
          index: 1,
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
    expect(screen.getByText('Find Fix')).toBeInTheDocument();
  });

  it('renders output stream when last step is processing', async () => {
    const propsWithProcessingStep = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        steps: [
          ...(defaultProps.data.steps ?? []),
          AutofixStepFixture({
            id: '3',
            type: AutofixStepType.DEFAULT,
            status: AutofixStatus.PROCESSING,
            progress: [
              AutofixProgressItemFixture({
                message: 'Processing message',
                timestamp: '2023-01-01T00:00:00Z',
              }),
            ],
            insights: [],
            index: 2,
          }),
        ],
      },
    };

    render(<AutofixSteps {...propsWithProcessingStep} />);
    await waitFor(() => {
      expect(screen.getByText('Processing message')).toBeInTheDocument();
    });
  });

  it('shows error message when previous step errored', () => {
    const propsWithErroredStep = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        steps: [
          AutofixStepFixture({
            id: '1',
            type: AutofixStepType.DEFAULT,
            status: AutofixStatus.ERROR,
            insights: [],
            progress: [],
            index: 0,
          }),
          AutofixStepFixture({
            id: '2',
            type: AutofixStepType.DEFAULT,
            status: AutofixStatus.PROCESSING,
            insights: [],
            progress: [],
            index: 1,
          }),
        ],
      },
    };

    render(<AutofixSteps {...propsWithErroredStep} />);
    expect(
      screen.getByText('Autofix encountered an error. Restarting step from scratch...')
    ).toBeInTheDocument();
  });
});
