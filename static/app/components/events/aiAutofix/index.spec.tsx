import {AutofixDataFixture} from 'sentry-fixture/autofixData';
import {AutofixProgressItemFixture} from 'sentry-fixture/autofixProgressItem';
import {AutofixStepFixture} from 'sentry-fixture/autofixStep';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AiAutofix} from 'sentry/components/events/aiAutofix';
import type {EventMetadataWithAutofix} from 'sentry/components/events/aiAutofix/types';

const group = GroupFixture();
const event = EventFixture();

describe('AiAutofix', () => {
  beforeAll(() => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/ai-autofix/`,
      body: null,
    });
  });

  it('renders the Banner component when autofixData is null', () => {
    render(<AiAutofix event={event} group={group} />);

    expect(screen.getByText('Try AI Autofix')).toBeInTheDocument();
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
      <AiAutofix
        event={event}
        group={{
          ...group,
          metadata: {
            autofix: autofixData,
          },
        }}
      />
    );

    // Should show latest log preview in header
    expect(await screen.findByText('Second log message')).toBeInTheDocument();
    // Others should not be visible
    expect(screen.queryByText('First log message')).not.toBeInTheDocument();

    // Opening step shows all logs
    await userEvent.click(screen.getByRole('button', {name: 'Toggle step details'}));
    expect(screen.getByText('First log message')).toBeInTheDocument();
    expect(screen.getByText('Second log message')).toBeInTheDocument();
  });

  it('renders the FixResult component when autofixData is present', () => {
    render(
      <AiAutofix
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

  it('can toggle logs for completed fix', async () => {
    render(
      <AiAutofix
        event={event}
        group={{
          ...group,
          metadata: {
            autofix: {
              status: 'COMPLETED',
              completed_at: '',
              created_at: '',
              steps: [
                {
                  id: '1',
                  index: 1,
                  title: 'I am processing',
                  completedMessage: 'oh yes I am',
                  status: 'PROCESSING',
                  progress: [],
                },
              ],
            },
          },
        }}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Toggle log details'}));

    expect(screen.getByText('1. I am processing')).toBeInTheDocument();
    expect(screen.getByText('oh yes I am')).toBeInTheDocument();
  });
});
