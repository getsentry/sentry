import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixProgressItemFixture} from 'sentry-fixture/autofixProgressItem';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Autofix} from 'sentry/components/events/autofix';
import type {EventMetadataWithAutofix} from 'sentry/components/events/autofix/types';

const group = GroupFixture();
const event = EventFixture();

describe('Autofix', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/ai-autofix/`,
      body: null,
    });
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/autofix/setup/`,
      body: {
        genAIConsent: {ok: true},
        integration: {ok: true},
      },
    });
  });

  it('renders the Banner component when autofixData is null', () => {
    render(<Autofix event={event} group={group} />);

    expect(screen.getByText('Try Autofix')).toBeInTheDocument();
  });

  it('renders steps with logs', async () => {
    const autofixData = AutofixDataFixture({
      steps: [
        AutofixStepFixture({
          id: '1',
          progress: [
            AutofixProgressItemFixture({message: 'First log message'}),
            AutofixProgressItemFixture({message: 'Second log message'}),
          ],
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/ai-autofix/`,
      body: autofixData,
    });

    render(
      <Autofix
        event={event}
        group={{
          ...group,
          metadata: {
            autofix: autofixData,
          },
        }}
      />
    );

    // Logs should be visible
    expect(screen.getByText('First log message')).toBeInTheDocument();
    expect(screen.getByText('Second log message')).toBeInTheDocument();

    // Toggling step hides old logs
    await userEvent.click(screen.getByRole('button', {name: 'Toggle step details'}));
    expect(screen.queryByText('First log message')).not.toBeInTheDocument();
    // Should show latest log preview in header
    expect(screen.getByText('Second log message')).toBeInTheDocument();
  });

  it('can reset and try again while running', async () => {
    const autofixData = AutofixDataFixture({
      steps: [
        AutofixStepFixture({
          id: '1',
          progress: [
            AutofixProgressItemFixture({message: 'First log message'}),
            AutofixProgressItemFixture({message: 'Second log message'}),
          ],
        }),
      ],
    });

    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/ai-autofix/`,
      body: autofixData,
    });

    const triggerAutofixMock = MockApiClient.addMockResponse({
      url: `/issues/${group.id}/ai-autofix/`,
      method: 'POST',
    });

    render(
      <Autofix
        event={event}
        group={{
          ...group,
          metadata: {
            autofix: autofixData,
          },
        }}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Start Over'}));

    expect(screen.getByText('Try Autofix')).toBeInTheDocument();

    // Clicking the fix button should show the initial state "Starting Autofix..." and call the api
    await userEvent.click(screen.getByRole('button', {name: 'Gimme Fix'}));
    expect(await screen.findByText('Starting Autofix...')).toBeInTheDocument();
    expect(triggerAutofixMock).toHaveBeenCalledTimes(1);
  });

  it('renders the FixResult component when autofixData is present', () => {
    render(
      <Autofix
        event={event}
        group={{
          ...group,
          metadata: {
            autofix: {
              status: 'COMPLETED',
              completed_at: '',
              created_at: '',
              fix: {
                title: 'Fixed the bug!',
                pr_number: 123,
                description: 'This is a description',
                pr_url: 'https://github.com/pulls/1234',
                repo_name: 'getsentry/sentry',
                diff: [],
              },
              steps: [],
            },
          } as EventMetadataWithAutofix,
        }}
      />
    );

    expect(screen.getByText('Fixed the bug!')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'View Pull Request'})).toHaveAttribute(
      'href',
      'https://github.com/pulls/1234'
    );
  });
});
