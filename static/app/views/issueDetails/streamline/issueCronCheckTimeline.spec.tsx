import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import type {StatsBucket} from 'sentry/components/checkInTimeline/types';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {IssueCategory, IssueType} from 'sentry/types/group';
import {IssueCronCheckTimeline} from 'sentry/views/issueDetails/streamline/issueCronCheckTimeline';
import {CheckInStatus} from 'sentry/views/monitors/types';
import {statusToText} from 'sentry/views/monitors/utils';

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

const mockBucket: StatsBucket<CheckInStatus> = {
  [CheckInStatus.OK]: 1,
  [CheckInStatus.ERROR]: 1,
  [CheckInStatus.IN_PROGRESS]: 1,
  [CheckInStatus.MISSED]: 1,
  [CheckInStatus.TIMEOUT]: 1,
  [CheckInStatus.UNKNOWN]: 1,
};

describe('IssueCronCheckTimeline', () => {
  const cronAlertId = '123';
  const organization = OrganizationFixture();
  const project = ProjectFixture({
    environments: ['dev', 'prod'],
  });
  const group = GroupFixture({
    issueCategory: IssueCategory.CRON,
    issueType: IssueType.MONITOR_CHECK_IN_FAILURE,
  });
  const event = EventFixture({
    tags: [
      {
        key: 'monitor.id',
        value: cronAlertId,
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

  it('renders the cron check timeline with a legend and data', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-stats/`,
      query: {
        monitor: [cronAlertId],
        project: project.slug,
        environment: 'dev',
      },
      body: {
        [cronAlertId]: [[startTime.getTime() / 1000, {dev: mockBucket}]],
      },
    });
    render(<IssueCronCheckTimeline group={group} />, {organization});

    expect(await screen.findByTestId('check-in-placeholder')).not.toBeInTheDocument();

    const legend = screen.getByRole('caption');
    expect(within(legend).getByText(statusToText[CheckInStatus.OK])).toBeInTheDocument();
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

    // Do not show environment labels if there is only one environment
    expect(screen.queryByText('dev')).not.toBeInTheDocument();
  });

  it('hides statuses from legend if not present in data', async function () {
    const newBucket = {
      ...mockBucket,
      // OK is always shown, even with no data
      [CheckInStatus.OK]: 0,
      [CheckInStatus.ERROR]: 0,
      [CheckInStatus.IN_PROGRESS]: 0,
      [CheckInStatus.TIMEOUT]: 0,
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-stats/`,
      query: {
        monitor: [cronAlertId],
        project: project.slug,
        environment: 'dev',
      },
      body: {
        [cronAlertId]: [[startTime.getTime() / 1000, {dev: newBucket}]],
      },
    });
    render(<IssueCronCheckTimeline group={group} />, {organization});
    expect(await screen.findByTestId('check-in-placeholder')).not.toBeInTheDocument();
    const legend = screen.getByRole('caption');
    [
      statusToText[CheckInStatus.OK],
      statusToText[CheckInStatus.MISSED],
      statusToText[CheckInStatus.UNKNOWN],
    ].forEach(status => {
      expect(within(legend).getByText(status)).toBeInTheDocument();
    });

    [
      statusToText[CheckInStatus.ERROR],
      statusToText[CheckInStatus.IN_PROGRESS],
      statusToText[CheckInStatus.TIMEOUT],
    ].forEach(status => {
      expect(within(legend).queryByText(status)).not.toBeInTheDocument();
    });
  });

  it('displays multiple environment legends and labels', async function () {
    const envBucketMapping = {
      dev: {
        [CheckInStatus.OK]: 1,
        [CheckInStatus.ERROR]: 1,
        [CheckInStatus.IN_PROGRESS]: 0,
        [CheckInStatus.MISSED]: 0,
        [CheckInStatus.TIMEOUT]: 1,
        [CheckInStatus.UNKNOWN]: 0,
      },
      prod: {
        [CheckInStatus.OK]: 0,
        [CheckInStatus.ERROR]: 0,
        [CheckInStatus.IN_PROGRESS]: 1,
        [CheckInStatus.MISSED]: 1,
        [CheckInStatus.TIMEOUT]: 0,
        [CheckInStatus.UNKNOWN]: 1,
      },
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-stats/`,
      query: {
        monitor: [cronAlertId],
        project: project.slug,
        environment: [],
      },
      body: {
        [cronAlertId]: [[startTime.getTime() / 1000, envBucketMapping]],
      },
    });
    render(<IssueCronCheckTimeline group={group} />, {organization});
    expect(await screen.findByTestId('check-in-placeholder')).not.toBeInTheDocument();
    const legend = screen.getByRole('caption');
    // All statuses from both environment timelines should be present
    [
      statusToText[CheckInStatus.OK],
      statusToText[CheckInStatus.ERROR],
      statusToText[CheckInStatus.IN_PROGRESS],
      statusToText[CheckInStatus.MISSED],
      statusToText[CheckInStatus.TIMEOUT],
      statusToText[CheckInStatus.UNKNOWN],
    ].forEach(status => {
      expect(within(legend).getByText(status)).toBeInTheDocument();
    });

    // Environment labels should now be present
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.getByText('prod')).toBeInTheDocument();
  });
});
