import {QueryClientProvider} from '@tanstack/react-query';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {apiOptions} from 'sentry/utils/api/apiOptions';

import {OverviewIssueAssignee} from './overviewIssueAssignee';
import type {AutofixOverviewResponse} from './types';

describe('OverviewIssueAssignee', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();

  const overviewResponse: AutofixOverviewResponse = {
    runsByMilestone: {
      autofix_root_cause: [
        {
          groupId: group.id,
          shortId: group.shortId,
          title: group.title,
          rootCause: null,
          proposedFix: null,
          seerRunId: 'run-1',
          lastTriggeredAt: '2026-07-14T09:00:00Z',
          pullRequests: [],
          issue: {
            assignedTo: null,
            count: '1',
            issueCategory: null,
            issueType: null,
            lastSeen: null,
            level: null,
            owners: [],
            priority: null,
            priorityLockedAt: null,
            project: {id: group.project.id, slug: group.project.slug},
            substatus: null,
            userCount: 1,
          },
        },
      ],
      autofix_solution: [],
      autofix_code_changes: [],
      has_pull_request: [],
      pull_requests_merged: [],
    },
  };

  it('patches the cache and survives a stale in-flight overview response', async () => {
    const assignee = UserFixture({
      id: '42',
      name: 'Next Assignee',
      email: 'next.assignee@example.com',
    });
    const assignedTo = {id: assignee.id, name: assignee.name, type: 'user'};
    const assignRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'PUT',
      body: {...group, assignedTo},
    });

    const queryClient = makeTestQueryClient();
    const overviewOptions = apiOptions.as<AutofixOverviewResponse>()(
      '/organizations/$organizationIdOrSlug/seer/autofix-overview/',
      {path: {organizationIdOrSlug: organization.slug}, staleTime: 0}
    );
    const overviewKey = overviewOptions.queryKey;
    queryClient.setQueryData(overviewKey, {json: overviewResponse, headers: {}});

    // A background refetch that is still in flight when the reassign lands, and
    // whose response carries the pre-assign assignee.
    let releaseStale!: () => void;
    const stale = new Promise<void>(resolve => {
      releaseStale = resolve;
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer/autofix-overview/`,
      asyncDelay: stale,
      body: overviewResponse,
    });
    const inFlight = queryClient.fetchQuery(overviewOptions);

    render(
      <QueryClientProvider client={queryClient}>
        <OverviewIssueAssignee
          groupId={group.id}
          projectId={group.project.id}
          projectSlug={group.project.slug}
          memberList={[assignee]}
        />
      </QueryClientProvider>,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Modify issue assignee'}));
    await userEvent.click(
      await screen.findByRole('option', {name: new RegExp(assignee.name)})
    );
    await waitFor(() => expect(assignRequest).toHaveBeenCalled());

    // Let the stale response resolve; the reassign must have cancelled it.
    releaseStale();
    await inFlight.catch(() => {});

    const patched = queryClient.getQueryData(overviewKey);
    expect(patched?.json.runsByMilestone.autofix_root_cause[0]?.issue.assignedTo).toEqual(
      assignedTo
    );
  });
});
