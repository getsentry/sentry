import {CheckInFixture} from 'sentry-fixture/checkIn';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import {IssueCategory, IssueType} from 'sentry/types/group';
import GroupCronChecks from 'sentry/views/issueDetails/groupCronChecks';
import {statusToText} from 'sentry/views/monitors/utils';

describe('GroupCronChecks', () => {
  const monitorId = 'f75a223c-aae1-47e4-8f77-6c72243cb76e';
  const event = EventFixture({
    tags: [
      {
        key: 'monitor.id',
        value: monitorId,
      },
    ],
  });
  const project = ProjectFixture();
  const group = GroupFixture({
    issueCategory: IssueCategory.CRON,
    issueType: IssueType.MONITOR_CHECK_IN_FAILURE,
    project,
  });
  const organization = OrganizationFixture();
  const router = RouterFixture({params: {groupId: group.id}});

  beforeEach(() => {
    GroupStore.init();
    GroupStore.add([group]);
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      body: group,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
      body: event,
    });
  });

  it('renders the empty cron check table', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitorId}/checkins/`,
      body: [],
    });

    render(<GroupCronChecks />, {organization, router});
    expect(await screen.findByText('All Monitor Checks')).toBeInTheDocument();
    for (const column of [
      'Timestamp',
      'Status',
      'Duration',
      'Environment',
      'Config',
      'ID',
    ]) {
      expect(screen.getByText(column)).toBeInTheDocument();
    }
    expect(screen.getByText('No matching monitor checks found')).toBeInTheDocument();
  });

  it('renders the cron check table with data', async () => {
    const check = CheckInFixture();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitorId}/checkins/`,
      body: [check],
    });

    render(<GroupCronChecks />, {organization, router});
    expect(await screen.findByText('All Monitor Checks')).toBeInTheDocument();
    expect(
      screen.queryByText('No matching monitor checks found')
    ).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-1 matching monitor checks')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous Page'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next Page'})).toBeInTheDocument();

    expect(screen.getByRole('time')).toHaveTextContent(/Jan 1, 2025/);
    expect(screen.getByText(statusToText[check.status])).toBeInTheDocument();
    expect(screen.getByText(`${check.duration}ms`)).toBeInTheDocument();
    expect(screen.getByText(check.environment)).toBeInTheDocument();
    expect(screen.getByText(check.id)).toBeInTheDocument();
  });
});
