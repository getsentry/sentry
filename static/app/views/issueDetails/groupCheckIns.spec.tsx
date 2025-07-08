import {CheckInFixture} from 'sentry-fixture/checkIn';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import GroupStore from 'sentry/stores/groupStore';
import {IssueCategory, IssueType} from 'sentry/types/group';
import {statusToText} from 'sentry/views/insights/crons/utils';
import GroupCheckIns from 'sentry/views/issueDetails/groupCheckIns';

describe('GroupCheckIns', () => {
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

  it('renders the empty check-in table', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitorId}/checkins/`,
      body: [],
    });

    render(<GroupCheckIns />, {
      organization,
      router,
      deprecatedRouterMocks: true,
    });
    expect(await screen.findByText('All Check-Ins')).toBeInTheDocument();
    expect(
      screen.getByText('No check-ins have been recorded for this time period.')
    ).toBeInTheDocument();
  });

  it('renders the check-in table with data', async () => {
    const check = CheckInFixture();
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/monitors/${monitorId}/checkins/`,
      body: [check],
    });

    render(<GroupCheckIns />, {
      organization,
      router,
      deprecatedRouterMocks: true,
    });
    expect(await screen.findByText('All Check-Ins')).toBeInTheDocument();
    expect(screen.queryByText('No matching check-ins found')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-1 matching check-ins')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous Page'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next Page'})).toBeInTheDocument();

    expect(screen.getByText(statusToText[check.status])).toBeInTheDocument();
    expect(screen.getByText('9 seconds')).toBeInTheDocument();
    expect(screen.getByText(check.environment)).toBeInTheDocument();
  });
});
