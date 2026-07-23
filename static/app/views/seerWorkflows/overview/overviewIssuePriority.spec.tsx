import {ActivityFeedFixture} from 'sentry-fixture/activityFeed';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {GroupActivityType, IssueType, PriorityLevel} from 'sentry/types/group';

import {OverviewIssuePriority} from './overviewIssuePriority';

describe('OverviewIssuePriority', () => {
  const organization = OrganizationFixture();
  const groupFixture = GroupFixture();

  function renderPriority(
    overrides: Partial<React.ComponentProps<typeof OverviewIssuePriority>> = {}
  ) {
    render(
      <OverviewIssuePriority
        groupId={groupFixture.id}
        issueType={groupFixture.issueType}
        priority={groupFixture.priority}
        priorityLockedAt={groupFixture.priorityLockedAt}
        projectId={groupFixture.project.id}
        {...overrides}
      />,
      {organization}
    );
  }

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {data: {dismissed_ts: null}},
    });
  });

  it('normalizes a null priority and updates the local priority after mutation', async () => {
    const updateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      method: 'PUT',
      body: {priority: PriorityLevel.HIGH},
    });

    renderPriority({
      issueType: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
      priority: null,
    });

    const priorityDropdown = screen.getByRole('button', {
      name: 'Modify issue priority',
    });
    expect(within(priorityDropdown).getByText('Med')).toBeInTheDocument();

    await userEvent.click(priorityDropdown);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'High'}));

    await waitFor(() =>
      expect(updateRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/issues/`,
        expect.objectContaining({
          data: expect.objectContaining({priority: PriorityLevel.HIGH}),
        })
      )
    );

    expect(
      within(
        await screen.findByRole('button', {name: 'Modify issue priority'})
      ).getByText('High')
    ).toBeInTheDocument();
  });

  it('resolves the actor for a user-edited priority', async () => {
    const activityRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${groupFixture.id}/activities/`,
      body: {
        activity: [
          ActivityFeedFixture({
            type: GroupActivityType.SET_PRIORITY,
            user: UserFixture({name: 'Priority Editor'}),
          }),
        ],
      },
    });

    renderPriority({priorityLockedAt: '2026-07-23T12:00:00Z'});

    await userEvent.click(screen.getByRole('button', {name: 'Modify issue priority'}));

    expect(
      await screen.findByText(textWithMarkupMatcher('Last edited by Priority Editor'))
    ).toBeInTheDocument();
    expect(activityRequest).toHaveBeenCalled();
  });

  it('disables priority changes for metric issues', () => {
    renderPriority({issueType: IssueType.METRIC_ISSUE});

    expect(screen.getByRole('button', {name: 'Modify issue priority'})).toBeDisabled();
  });
});
