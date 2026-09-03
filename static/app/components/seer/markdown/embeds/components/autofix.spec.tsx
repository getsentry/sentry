import {useInfiniteQuery} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {AutofixRef} from 'sentry/components/seer/markdown/embeds/components/autofix';
import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

const organization = OrganizationFixture({slug: 'org-slug'});
const GROUP_ID = '1337';

function makeRun(status: ExplorerAutofixState['status']): ExplorerAutofixState {
  const finished = status !== 'processing';

  return {
    run_id: 42,
    status,
    updated_at: '2026-01-01T00:00:00Z',
    blocks: [
      {
        id: 'block-1',
        timestamp: '2026-01-01T00:00:00Z',
        loading: !finished,
        message: {
          role: 'assistant',
          // 'Thinking...' is what keeps an unfinished section out of the
          // completed state; any other assistant content closes the section.
          content: finished ? 'Here is what went wrong' : 'Thinking...',
          metadata: {step: 'root_cause'},
        },
        artifacts: finished
          ? [
              {
                key: 'artifact-1',
                reason: 'Found a root cause',
                data: {
                  one_line_description: 'The cache key collides across orgs',
                  five_whys: ['The key omits the org slug'],
                },
              },
            ]
          : [],
      },
    ],
  };
}

/**
 * Stands in for a page the chat panel slides over: it holds an issue-list query
 * open so the refetch triggered by a finished step is observable.
 */
function InboxBehindThePanel() {
  const org = useOrganization();

  useInfiniteQuery(
    apiOptions.asInfinite<Group[]>()('/organizations/$organizationIdOrSlug/issues/', {
      path: {organizationIdOrSlug: org.slug},
      query: {query: 'issue.progress:diagnosed is:unresolved'},
      staleTime: 0,
    })
  );

  return (
    <AutofixRef
      name="autofixRef"
      level="block"
      data={{id: GROUP_ID, shortId: 'JAVASCRIPT-1', runId: 42, step: 'root_cause'}}
    />
  );
}

describe('AutofixRef embed', () => {
  let issuesMock: jest.Mock;

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    issuesMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${GROUP_ID}/pull-requests/`,
      body: {pullRequests: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues-count/`,
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      body: {runsByMilestone: {}},
    });
  });

  it('refreshes the page behind it when the step result lands', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
      body: {autofix: makeRun('processing')},
    });

    render(<InboxBehindThePanel />, {organization});

    expect(await screen.findByText('Finding the root cause…')).toBeInTheDocument();
    await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(1));

    // The run finishes while the panel is open; the embed polls it up.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
      body: {autofix: makeRun('completed')},
    });

    expect(
      await screen.findByText('The cache key collides across orgs', undefined, {
        timeout: 5000,
      })
    ).toBeInTheDocument();
    await waitFor(() => expect(issuesMock).toHaveBeenCalledTimes(2));
  });

  it('leaves the page alone while the step is still running', async () => {
    const autofixMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${GROUP_ID}/autofix/`,
      body: {autofix: makeRun('processing')},
    });

    render(<InboxBehindThePanel />, {organization});

    expect(await screen.findByText('Finding the root cause…')).toBeInTheDocument();

    // Let the 1s status poll come round more than once: a partial result must
    // not yank the list out from under whoever is reading it.
    await waitFor(() => expect(autofixMock).toHaveBeenCalledTimes(3), {timeout: 5000});
    expect(issuesMock).toHaveBeenCalledTimes(1);
  });
});
