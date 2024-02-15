import {GroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AiAutofix} from 'sentry/components/events/aiAutofix';
import type {EventMetadataWithAutofix} from 'sentry/components/events/aiAutofix/types';

const group = GroupFixture();

describe('AiAutofix', () => {
  beforeAll(() => {
    MockApiClient.addMockResponse({
      url: `/issues/${group.id}/ai-autofix/`,
      body: null,
    });
  });

  it('renders the Banner component when autofixData is null', () => {
    render(<AiAutofix group={group} />);

    expect(screen.getByText('Try AI Autofix')).toBeInTheDocument();
  });

  it('renders the FixResult component when autofixData is present', () => {
    render(
      <AiAutofix
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
                pr_url: '',
                repo_name: 'getsentry/sentry',
              },
              steps: [],
            },
          } as EventMetadataWithAutofix,
        }}
      />
    );

    expect(screen.getByText('Fixed the bug!')).toBeInTheDocument();
    expect(screen.getByText('View Pull Request')).toBeInTheDocument();
  });

  it('renders the correct steps', () => {
    render(
      <AiAutofix
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
                  description: 'oh yes I am',
                  status: 'PROCESSING',
                },
              ],
            },
          },
        }}
      />
    );

    expect(screen.getByText('I am processing')).toBeInTheDocument();
    expect(screen.getByText('oh yes I am')).toBeInTheDocument();
  });
});
