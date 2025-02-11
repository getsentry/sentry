import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueCategory, IssueType} from 'sentry/types/group';
import {CheckStatus} from 'sentry/views/alerts/rules/uptime/types';
import {statusToText} from 'sentry/views/insights/uptime/timelineConfig';
import {IssueUptimeCheckTimeline} from 'sentry/views/issueDetails/streamline/issueUptimeCheckTimeline';

const startTime = new Date('2025-01-01T11:00:00Z');

jest.mock('sentry/components/checkInTimeline/hooks/useTimeWindowConfig');

jest
  .mocked(useTimeWindowConfig)
  .mockReturnValue(
    getConfigFromTimeRange(
      startTime,
      new Date(startTime.getTime() + 1000 * 60 * 60),
      1000
    )
  );

describe('IssueUptimeCheckTimeline', () => {
  const uptimeRuleId = '123';
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    environments: ['production'],
  });
  const group = GroupFixture({
    issueCategory: IssueCategory.UPTIME,
    issueType: IssueType.UPTIME_DOMAIN_FAILURE,
  });
  const event = EventFixture({
    tags: [
      {
        key: 'uptime_rule',
        value: uptimeRuleId,
      },
    ],
  });

  beforeEach(() => {
    GroupStore.init();
    GroupStore.add([group]);
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
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

  it('renders the uptime check timeline with a legend and data', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-stats/`,
      query: {
        projectUptimeSubscriptionId: [uptimeRuleId],
      },
      body: {
        [uptimeRuleId]: [
          [
            new Date('2025-01-01T11:00:00Z').getTime() / 1000,
            {
              [CheckStatus.SUCCESS]: 1,
              [CheckStatus.MISSED_WINDOW]: 1,
              [CheckStatus.FAILURE]: 1,
            },
          ],
        ],
      },
    });
    render(<IssueUptimeCheckTimeline group={group} />, {organization});

    expect(await screen.findByTestId('check-in-placeholder')).not.toBeInTheDocument();

    const legend = screen.getByRole('caption');
    expect(
      within(legend).getByText(statusToText[CheckStatus.SUCCESS])
    ).toBeInTheDocument();
    expect(
      within(legend).getByText(statusToText[CheckStatus.MISSED_WINDOW])
    ).toBeInTheDocument();
    expect(
      within(legend).getByText(statusToText[CheckStatus.FAILURE])
    ).toBeInTheDocument();

    expect(screen.getByRole('figure')).toBeInTheDocument();

    const gridlineLabels = [
      'Jan 1, 2025 11:00 AM UTC',
      '11:10 AM',
      '11:20 AM',
      '11:30 AM',
      '11:40 AM',
      '11:50 AM',
    ];

    gridlineLabels.forEach(label => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('hides missed status from legend if not present in data', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/uptime-stats/`,
      query: {
        projectUptimeSubscriptionId: [uptimeRuleId],
      },
      body: {
        [uptimeRuleId]: [
          [
            startTime.getTime() / 1000,
            {
              [CheckStatus.SUCCESS]: 1,
              [CheckStatus.FAILURE]: 1,
            },
          ],
        ],
      },
    });
    render(<IssueUptimeCheckTimeline group={group} />, {organization});
    expect(await screen.findByTestId('check-in-placeholder')).not.toBeInTheDocument();

    const legend = screen.getByRole('caption');
    expect(
      within(legend).getByText(statusToText[CheckStatus.SUCCESS])
    ).toBeInTheDocument();
    expect(
      within(legend).queryByText(statusToText[CheckStatus.MISSED_WINDOW])
    ).not.toBeInTheDocument();
    expect(
      within(legend).getByText(statusToText[CheckStatus.FAILURE])
    ).toBeInTheDocument();
  });
});
