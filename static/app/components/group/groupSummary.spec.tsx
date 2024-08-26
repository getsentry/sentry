import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  GroupSummary,
  makeGroupSummaryQueryKey,
} from 'sentry/components/group/groupSummary';

describe('GroupSummary', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the group summary', async function () {
    const groupId = '1';
    const organizationSlug = 'org-slug';
    MockApiClient.addMockResponse({
      url: makeGroupSummaryQueryKey(organizationSlug, groupId)[0],
      method: 'POST',
      body: {
        groupId,
        summary: 'Test summary',
        impact: 'Test impact',
      },
    });

    MockApiClient.addMockResponse({
      url: `/issues/${groupId}/autofix/setup/`,
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
      },
    });

    render(<GroupSummary groupId={groupId} />);

    await waitFor(() => {
      expect(screen.getByText('Issue Summary')).toBeInTheDocument();
    });

    expect(screen.getByText('Issue Summary')).toBeInTheDocument();
    expect(screen.getByText('Test summary')).toBeInTheDocument();
    expect(screen.getByText('Potential Impact')).toBeInTheDocument();
    expect(screen.getByText('Test impact')).toBeInTheDocument();
  });

  it('does not render the group summary if no consent', async function () {
    const groupId = '1';
    const organizationSlug = 'org-slug';
    MockApiClient.addMockResponse({
      url: makeGroupSummaryQueryKey(organizationSlug, groupId)[0],
      method: 'POST',
      body: {
        groupId,
        summary: 'Test summary',
        impact: 'Test impact',
      },
    });

    const setupCall = MockApiClient.addMockResponse({
      url: `/issues/${groupId}/autofix/setup/`,
      body: {
        genAIConsent: {ok: false},
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
      },
    });

    render(<GroupSummary groupId={groupId} />);

    await waitFor(
      () => {
        expect(setupCall).toHaveBeenCalled();
      },
      {timeout: 5000}
    );

    expect(screen.queryByText('Issue Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Test summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Potential Impact')).not.toBeInTheDocument();
    expect(screen.queryByText('Test impact')).not.toBeInTheDocument();
  });
});
