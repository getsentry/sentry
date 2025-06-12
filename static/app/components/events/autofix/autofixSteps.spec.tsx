import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixProgressItemFixture} from 'sentry-fixture/autofixProgressItem';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AutofixSteps} from 'sentry/components/events/autofix/autofixSteps';
import {AutofixStatus, AutofixStepType} from 'sentry/components/events/autofix/types';

describe('AutofixSteps', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
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
              root_cause_reproduction: [
                {
                  title: 'step 1',
                  code_snippet_and_analysis: 'details',
                  is_most_important_event: true,
                  relevant_code_file: {
                    file_path: 'file.py',
                    repo_name: 'owner/repo',
                  },
                  timeline_item_type: 'internal_code',
                },
              ],
            },
          ],
          selection: null,
          progress: [],
          index: 1,
        }),
      ],
      request: {
        repos: [],
      },
      codebases: {},
      last_triggered_at: '2023-01-01T00:00:00Z',
      run_id: '1',
      status: AutofixStatus.PROCESSING,
    }),
    groupId: 'group1',
    runId: 'run1',
  } satisfies React.ComponentProps<typeof AutofixSteps>;

  it('renders steps correctly', async () => {
    render(<AutofixSteps {...defaultProps} />);

    expect(await screen.findByText('step 1')).toBeInTheDocument();
  });

  it('renders output stream when last step is processing', async () => {
    const propsWithProcessingStep: React.ComponentProps<typeof AutofixSteps> = {
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
    expect(
      await screen.findByText('Processing message', undefined, {timeout: 10_000})
    ).toBeInTheDocument();
  }, 10_000);

  it('shows error message when previous step errored', async () => {
    const propsWithErroredStep: React.ComponentProps<typeof AutofixSteps> = {
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
      await screen.findByText(
        'Seer encountered an error. Restarting step from scratch...'
      )
    ).toBeInTheDocument();
  });
});
