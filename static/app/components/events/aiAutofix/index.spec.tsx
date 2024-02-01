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

    expect(screen.getByText('AI Autofix')).toBeInTheDocument();
  });

  it('renders the FixResult component when autofixData is present', () => {
    render(
      <AiAutofix
        group={{
          ...group,
          metadata: {
            autofix: {
              status: 'COMPLETED',
              completedAt: '',
              createdAt: '',
              fix: {
                title: 'Fixed the bug!',
              },
            },
          } as EventMetadataWithAutofix,
        }}
      />
    );

    expect(screen.getByText('Fixed the bug!')).toBeInTheDocument();
    expect(screen.getByText('View Pull Request')).toBeInTheDocument();
  });
});
