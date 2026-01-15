import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TickStyle} from 'sentry/components/checkInTimeline/types';
import {SchedulePreviewStatus} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets';
import {ScheduleType} from 'sentry/views/insights/crons/types';

import {SchedulePreview} from './schedulePreview';

jest.mock('sentry/utils/useDimensions', () => ({
  useDimensions: () => ({width: 800}),
}));

describe('SchedulePreview', () => {
  const organization = OrganizationFixture();

  const tickStyle: TickStyle<SchedulePreviewStatus> = theme => ({
    [SchedulePreviewStatus.ERROR]: {
      labelColor: theme.colors.red500,
      tickColor: theme.colors.red400,
    },
    [SchedulePreviewStatus.OK]: {
      labelColor: theme.colors.green500,
      tickColor: theme.colors.green400,
    },
    [SchedulePreviewStatus.SUB_FAILURE_ERROR]: {
      labelColor: theme.colors.red500,
      tickColor: theme.colors.red400,
      hatchTick: theme.colors.red200,
    },
    [SchedulePreviewStatus.SUB_RECOVERY_OK]: {
      labelColor: theme.colors.green500,
      tickColor: theme.colors.green400,
      hatchTick: theme.colors.green200,
    },
  });

  const statusToText: Record<SchedulePreviewStatus, string> = {
    [SchedulePreviewStatus.OK]: 'Okay',
    [SchedulePreviewStatus.ERROR]: 'Failed',
    [SchedulePreviewStatus.SUB_FAILURE_ERROR]: 'Failed (Sub-Threshold)',
    [SchedulePreviewStatus.SUB_RECOVERY_OK]: 'Okay (Sub-Threshold)',
  };

  const statusPrecedent: SchedulePreviewStatus[] = [
    SchedulePreviewStatus.SUB_FAILURE_ERROR,
    SchedulePreviewStatus.SUB_RECOVERY_OK,
    SchedulePreviewStatus.ERROR,
    SchedulePreviewStatus.OK,
  ];

  it('renders the open period bar and labels', async () => {
    const start = 1700000000;

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-schedule-window/`,
      body: {start, end: start + 3600},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-schedule-buckets/`,
      body: [
        [start, {[SchedulePreviewStatus.OK]: 1}],
        [start + 600, {[SchedulePreviewStatus.ERROR]: 1}],
        [start + 1200, {[SchedulePreviewStatus.OK]: 1}],
      ],
    });

    render(
      <SchedulePreview
        scheduleType={ScheduleType.CRONTAB}
        scheduleCrontab="0 0 * * *"
        scheduleIntervalValue={1}
        scheduleIntervalUnit="day"
        timezone="UTC"
        failureIssueThreshold={2}
        recoveryThreshold={3}
        tickStyle={tickStyle}
        statusToText={statusToText}
        statusPrecedent={statusPrecedent}
        isSticky
      />,
      {organization}
    );

    expect(await screen.findByText('Issue Open Period')).toBeInTheDocument();
    expect(screen.getByText('2 failed check-ins')).toBeInTheDocument();
    expect(screen.getByText('3 success check-ins')).toBeInTheDocument();
  });

  it('shows a warning when the schedule is invalid (400)', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-schedule-window/`,
      statusCode: 400,
      body: {schedule: ['Invalid schedule']},
    });

    render(
      <SchedulePreview
        scheduleType={ScheduleType.CRONTAB}
        scheduleCrontab="not a cron"
        scheduleIntervalValue={1}
        scheduleIntervalUnit="day"
        timezone="UTC"
        failureIssueThreshold={2}
        recoveryThreshold={3}
        tickStyle={tickStyle}
        statusToText={statusToText}
        statusPrecedent={statusPrecedent}
        isSticky
      />,
      {organization}
    );

    expect(
      await screen.findByText(/No schedule preview available\./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/schedule: Invalid schedule/i)).toBeInTheDocument();
  });

  it('shows a generic error on non-400 errors', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitors-schedule-window/`,
      statusCode: 500,
      body: {detail: 'Internal error'},
    });

    render(
      <SchedulePreview
        scheduleType={ScheduleType.CRONTAB}
        scheduleCrontab="0 0 * * *"
        scheduleIntervalValue={1}
        scheduleIntervalUnit="day"
        timezone="UTC"
        failureIssueThreshold={2}
        recoveryThreshold={3}
        tickStyle={tickStyle}
        statusToText={statusToText}
        statusPrecedent={statusPrecedent}
        isSticky
      />,
      {organization}
    );

    expect(
      await screen.findByText(/Failed to load schedule preview/i)
    ).toBeInTheDocument();
  });
});
