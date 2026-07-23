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

import {
  GroupActivityType,
  IssueCategory,
  IssueType,
  PriorityLevel,
} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';

import {
  OverviewIssuePriority,
  type OverviewIssuePriorityGroup,
} from './overviewIssuePriority';

jest.mock('sentry/utils/analytics');

describe('OverviewIssuePriority', () => {
  const organization = OrganizationFixture();
  const groupFixture = GroupFixture();

  function makeGroup(
    overrides: Partial<OverviewIssuePriorityGroup> = {}
  ): OverviewIssuePriorityGroup {
    return {
      assignedTo: groupFixture.assignedTo,
      count: groupFixture.count,
      id: groupFixture.id,
      issueCategory: groupFixture.issueCategory,
      issueType: groupFixture.issueType,
      lastSeen: groupFixture.lastSeen,
      level: groupFixture.level,
      owners: groupFixture.owners,
      priority: groupFixture.priority,
      priorityLockedAt: groupFixture.priorityLockedAt,
      project: {id: groupFixture.project.id},
      ...overrides,
    };
  }

  beforeEach(() => {
    jest.mocked(trackAnalytics).mockClear();
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

    render(
      <OverviewIssuePriority
        group={makeGroup({
          issueCategory: IssueCategory.PERFORMANCE,
          issueType: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
          priority: null,
        })}
      />,
      {organization}
    );

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

    expect(trackAnalytics).toHaveBeenCalledWith(
      'issue_details.set_priority',
      expect.objectContaining({
        from_priority: PriorityLevel.MEDIUM,
        issue_category: IssueCategory.PERFORMANCE,
        issue_type: IssueType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
        to_priority: PriorityLevel.HIGH,
      })
    );
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

    render(
      <OverviewIssuePriority
        group={makeGroup({priorityLockedAt: '2026-07-23T12:00:00Z'})}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Modify issue priority'}));

    expect(
      await screen.findByText(textWithMarkupMatcher('Last edited by Priority Editor'))
    ).toBeInTheDocument();
    expect(activityRequest).toHaveBeenCalled();
  });

  it('disables priority changes for metric issues', () => {
    render(
      <OverviewIssuePriority
        group={makeGroup({
          issueCategory: IssueCategory.METRIC,
          issueType: IssueType.METRIC_ISSUE,
        })}
      />,
      {organization}
    );

    expect(screen.getByRole('button', {name: 'Modify issue priority'})).toBeDisabled();
  });
});
