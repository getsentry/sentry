import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixProgressItemFixture} from 'sentry-fixture/autofixProgressItem';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Autofix} from 'sentry/components/events/autofix';
import {AutofixStepType} from 'sentry/components/events/autofix/types';

const group = GroupFixture();
const event = EventFixture();

describe('Autofix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
        githubWriteIntegration: {
          ok: true,
          repos: [
            {
              provider: 'integrations:github',
              owner: 'getsentry',
              name: 'sentry',
              external_id: '123',
            },
          ],
        },
        codebaseIndexing: {ok: true},
      },
    });
  });

  it('renders the Banner component when autofixData is null', () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/`,
      body: null,
    });

    render(<Autofix event={event} group={group} />);

    expect(screen.getByText('Try Autofix')).toBeInTheDocument();
  });

  it('renders steps with logs', async () => {
    const autofixData = AutofixDataFixture({
      steps: [
        AutofixStepFixture({
          id: '1',
          status: 'PROCESSING',
          progress: [
            AutofixProgressItemFixture({message: 'First log message'}),
            AutofixProgressItemFixture({message: 'Second log message'}),
          ],
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/`,
      body: {autofix: autofixData},
    });

    render(<Autofix event={event} group={group} />);

    // Logs should be visible
    expect(await screen.findByText('First log message')).toBeInTheDocument();
    expect(screen.getByText('Second log message')).toBeInTheDocument();

    // Toggling step hides old logs
    await userEvent.click(screen.getByRole('button', {name: 'Toggle step details'}));
    expect(screen.queryByText('First log message')).not.toBeInTheDocument();
    // Should show latest log preview in header
    expect(screen.getByText('Second log message')).toBeInTheDocument();
  });

  it('can reset and try again while running', async () => {
    const autofixData = AutofixDataFixture({
      steps: [AutofixStepFixture({})],
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/`,
      body: {autofix: autofixData},
    });

    const triggerAutofixMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/`,
      method: 'POST',
    });

    render(<Autofix event={event} group={group} />);

    await userEvent.click(await screen.findByRole('button', {name: 'Start Over'}));

    expect(screen.getByText('Try Autofix')).toBeInTheDocument();

    // Clicking the fix button should show the initial state "Starting Autofix..." and call the api
    await userEvent.click(screen.getByRole('button', {name: 'Gimme Fix'}));
    expect(await screen.findByText('Starting Autofix...')).toBeInTheDocument();
    expect(triggerAutofixMock).toHaveBeenCalledTimes(1);
  });

  it('renders the root cause component when changes step is present', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/`,
      body: {
        autofix: AutofixDataFixture({
          steps: [
            AutofixStepFixture({
              type: AutofixStepType.ROOT_CAUSE_ANALYSIS,
              title: 'Root Cause',
              causes: [
                {
                  actionability: 1,
                  id: 'cause-1',
                  likelihood: 1,
                  title: 'Test Cause Title',
                  description: 'Test Cause Description',
                  suggested_fixes: [
                    {
                      id: 'fix-1',
                      title: 'Test Fix Title',
                      description: 'Test Fix Description',
                      elegance: 1,
                      snippet: {
                        file_path: 'test/file/path.py',
                        snippet: 'two = 1 + 1',
                      },
                    },
                  ],
                },
              ],
            }),
          ],
        }),
      },
    });

    render(<Autofix event={event} group={group} />);

    expect(await screen.findByText('Root Cause')).toBeInTheDocument();
    expect(
      screen.getByText(/Sentry has identified 1 potential root cause/)
    ).toBeInTheDocument();
    expect(screen.getByText('Test Cause Title')).toBeInTheDocument();
    expect(screen.getByText('Test Cause Description')).toBeInTheDocument();
  });

  it('renders the diff component when changes step is present', async () => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/`,
      body: {
        autofix: AutofixDataFixture({
          steps: [
            AutofixStepFixture({
              type: AutofixStepType.CHANGES,
              title: 'Review Fix',
              changes: [
                {
                  title: 'Test PR Title',
                  description: 'Test PR Description',
                  repo_id: 1,
                  repo_name: 'getsentry/sentry',
                  diff: [],
                },
              ],
            }),
          ],
        }),
      },
    });

    render(<Autofix event={event} group={group} />);

    expect(await screen.findByText('Review Fix')).toBeInTheDocument();
    expect(screen.getByText('getsentry/sentry')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Create a Pull Request'})
    ).toBeInTheDocument();
  });
});
