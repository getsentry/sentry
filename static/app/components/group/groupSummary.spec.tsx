import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  GroupSummary,
  GroupSummaryHeader,
  makeGroupSummaryQueryKey,
} from 'sentry/components/group/groupSummary';
import {IssueCategory} from 'sentry/types/group';

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

    render(<GroupSummary groupId={groupId} groupCategory={IssueCategory.ERROR} />);

    expect(await screen.findByText('Issue Summary')).toBeInTheDocument();

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

    render(<GroupSummary groupId={groupId} groupCategory={IssueCategory.ERROR} />);

    await waitFor(() => {
      expect(setupCall).toHaveBeenCalled();
    });

    expect(screen.queryByText('Issue Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Test summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Potential Impact')).not.toBeInTheDocument();
    expect(screen.queryByText('Test impact')).not.toBeInTheDocument();
  });

  it('does not render the group summary if not an error', function () {
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

    render(<GroupSummary groupId={groupId} groupCategory={IssueCategory.PERFORMANCE} />);

    expect(screen.queryByText('Issue Summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Test summary')).not.toBeInTheDocument();
    expect(screen.queryByText('Potential Impact')).not.toBeInTheDocument();
    expect(screen.queryByText('Test impact')).not.toBeInTheDocument();
  });
});

describe('GroupSummaryHeader', function () {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders the group summary header', async function () {
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

    render(<GroupSummaryHeader groupId={groupId} groupCategory={IssueCategory.ERROR} />);

    expect(await screen.findByText('Test headline')).toBeInTheDocument();
  });

  it('does not render the group summary headline if no consent', async function () {
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

    render(<GroupSummaryHeader groupId={groupId} groupCategory={IssueCategory.ERROR} />);

    await waitFor(() => {
      expect(setupCall).toHaveBeenCalled();
    });

    expect(screen.queryByText('Test headline')).not.toBeInTheDocument();
  });

  it('does not render the group summary headline if not an error', function () {
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

    render(
      <GroupSummaryHeader groupId={groupId} groupCategory={IssueCategory.PERFORMANCE} />
    );
    expect(screen.queryByText('Test headline')).not.toBeInTheDocument();
  });
});
