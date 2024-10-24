import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  GroupSummary,
  makeGroupSummaryQueryKey,
} from 'sentry/components/group/groupSummary';
import {IssueCategory} from 'sentry/types/group';

describe('GroupSummary', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the collapsed group summary', async function () {
    const groupId = '1';
    const organizationSlug = 'org-slug';

    MockApiClient.addMockResponse({
      url: makeGroupSummaryQueryKey(organizationSlug, groupId)[0],
      method: 'POST',
      body: {
        groupId,
        summary: 'Test summary',
        impact: 'Test impact',
        headline: 'Test headline',
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

    render(<GroupSummary groupId={groupId} groupCategory={IssueCategory.ERROR} />);

    // Verify the summary loads and renders the collapsed view
    expect(await screen.findByText('Test headline')).toBeInTheDocument();
    expect(screen.getByText('Details: Test summary')).toBeInTheDocument();
    expect(screen.queryByText('Impact: Test impact')).not.toBeInTheDocument();
  });

  it('expands the summary when clicked', async function () {
    const groupId = '1';
    const organizationSlug = 'org-slug';

    MockApiClient.addMockResponse({
      url: makeGroupSummaryQueryKey(organizationSlug, groupId)[0],
      method: 'POST',
      body: {
        groupId,
        summary: 'Test summary',
        impact: 'Test impact',
        headline: 'Test headline',
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

    render(<GroupSummary groupId={groupId} groupCategory={IssueCategory.ERROR} />);
    expect(await screen.findByText('Test headline')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Test headline'));
    expect(screen.getByText('Test summary')).toBeInTheDocument();
  });

  it('does not render the summary if no consent', async function () {
    const groupId = '1';
    const organizationSlug = 'org-slug';

    MockApiClient.addMockResponse({
      url: makeGroupSummaryQueryKey(organizationSlug, groupId)[0],
      method: 'POST',
      body: {
        groupId,
        summary: 'Test summary',
        impact: 'Test impact',
        headline: 'Test headline',
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

    render(<GroupSummary groupId={groupId} groupCategory={IssueCategory.ERROR} />);

    await waitFor(() => {
      expect(setupCall).toHaveBeenCalled();
    });

    expect(screen.queryByText('Test headline')).not.toBeInTheDocument();
    expect(screen.queryByText('Test summary')).not.toBeInTheDocument();
  });

  it('does not render the summary if the issue is not in the error category', function () {
    const groupId = '1';
    const organizationSlug = 'org-slug';

    MockApiClient.addMockResponse({
      url: makeGroupSummaryQueryKey(organizationSlug, groupId)[0],
      method: 'POST',
      body: {
        groupId,
        summary: 'Test summary',
        impact: 'Test impact',
        headline: 'Test headline',
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

    render(<GroupSummary groupId={groupId} groupCategory={IssueCategory.PERFORMANCE} />);

    expect(screen.queryByText('Test headline')).not.toBeInTheDocument();
    expect(screen.queryByText('Test summary')).not.toBeInTheDocument();
  });
});
