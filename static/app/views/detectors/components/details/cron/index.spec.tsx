import {CheckInFixture} from 'sentry-fixture/checkIn';
import {
  CronDetectorFixture,
  CronMonitorDataSourceFixture,
  CronMonitorEnvironmentFixture,
} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {UserTimezoneProvider} from 'sentry/components/timezoneProvider';
import ConfigStore from 'sentry/stores/configStore';
import {CronDetectorDetails} from 'sentry/views/detectors/components/details/cron';

describe('CronDetectorDetails - check-ins', () => {
  const project = ProjectFixture();
  const cronDataSource = CronMonitorDataSourceFixture({
    queryObj: {
      ...CronMonitorDataSourceFixture().queryObj,
      // Ensure we have a lastCheckIn so the check-ins section is shown
      environments: [
        CronMonitorEnvironmentFixture({
          lastCheckIn: '2025-01-01T00:00:00Z',
        }),
      ],
    },
  });
  const detector = CronDetectorFixture({
    id: '1',
    projectId: project.id,
    workflowIds: [],
    dataSources: [cronDataSource],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/?limit=5&query=is%3Aunresolved%20detector%3A1&statsPeriod=14d`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/users/1/`,
      body: UserFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/monitors/${cronDataSource.queryObj.slug}/checkins/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/`,
      body: GroupFixture(),
    });
  });

  it('should show onboarding when the monitor has never checked in', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/keys/`,
      body: ProjectKeysFixture(),
    });

    const noCheckInDataSource = CronMonitorDataSourceFixture({
      queryObj: {
        ...CronMonitorDataSourceFixture().queryObj,
        environments: [
          CronMonitorEnvironmentFixture({
            lastCheckIn: null,
            nextCheckIn: null,
          }),
        ],
      },
    });

    const noCheckInDetector = CronDetectorFixture({
      id: '2',
      projectId: project.id,
      dataSources: [noCheckInDataSource],
    });

    render(<CronDetectorDetails detector={noCheckInDetector} project={project} />);

    expect(
      await screen.findByRole('heading', {name: 'Instrument your monitor'})
    ).toBeInTheDocument();
    expect(screen.getByText('Waiting for first Check-in')).toBeInTheDocument();
    expect(screen.queryByText('Recent Check-Ins')).not.toBeInTheDocument();
  });

  describe('check-ins', () => {
    it('shows recent check-ins with an empty table', async () => {
      render(<CronDetectorDetails detector={detector} project={project} />);

      expect(await screen.findByText('Recent Check-Ins')).toBeInTheDocument();
      expect(
        screen.getByText('No check-ins have been recorded for this time period.')
      ).toBeInTheDocument();
    });

    it('shows recent check-ins with a table when they exist', async () => {
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/${project.slug}/monitors/${cronDataSource.queryObj.slug}/checkins/`,
        body: [CheckInFixture()],
      });

      render(<CronDetectorDetails detector={detector} project={project} />);

      // Wait for data to load and a row to render
      expect(await screen.findByText('Failed')).toBeInTheDocument();

      // Should render table headers
      expect(screen.getAllByRole('columnheader', {name: 'Status'})).toHaveLength(2);
      expect(screen.getByRole('columnheader', {name: 'Started'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Completed'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Duration'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Issues'})).toBeInTheDocument();
      expect(screen.getByRole('columnheader', {name: 'Expected At'})).toBeInTheDocument();

      // Empty-state should not be visible when data exists
      expect(
        screen.queryByText('No check-ins have been recorded for this time period.')
      ).not.toBeInTheDocument();
    });
  });

  describe('timezone selector', () => {
    it('displays check-in times in different timezones when switching', async () => {
      // Create a monitor with Pacific timezone PST/PDT (UTC-8)
      const monitorTimezone = 'America/Los_Angeles';

      const defaultDataSource = CronMonitorDataSourceFixture();
      const dataSouce = CronMonitorDataSourceFixture({
        queryObj: {
          ...defaultDataSource.queryObj,
          config: {...defaultDataSource.queryObj.config, timezone: monitorTimezone},
          environments: [
            CronMonitorEnvironmentFixture({lastCheckIn: '2025-01-01T00:00:01Z'}),
          ],
        },
      });

      const detectorWithCheckIn = CronDetectorFixture({dataSources: [dataSouce]});

      MockApiClient.addMockResponse({
        url: `/projects/org-slug/${project.slug}/monitors/${detectorWithCheckIn.dataSources[0].queryObj.slug}/checkins/`,
        body: [CheckInFixture()],
      });

      // Set user timezone to New York EST/EDT (UTC-4)
      const user = UserFixture();
      user.options.timezone = 'America/New_York';
      ConfigStore.set('user', user);

      render(
        <UserTimezoneProvider>
          <CronDetectorDetails detector={detectorWithCheckIn} project={project} />
        </UserTimezoneProvider>
      );

      // Wait for check-ins to load and find the table after the heading
      const recentCheckInsHeading = await screen.findByText('Recent Check-Ins');
      const container = recentCheckInsHeading.parentElement!;
      const checkInTable = within(container).getByRole('table');

      // Find the "Started" column index
      const headers = within(checkInTable).getAllByRole('columnheader');
      const startedColumnIndex = headers.findIndex(h => h.textContent === 'Started');

      // Get the first data row and the time cell
      const rows = within(checkInTable).getAllByRole('row');
      const cells = within(rows[1]!).getAllByRole('cell');
      const timeCell = cells[startedColumnIndex]!;

      // Initially shows in user timezone (New York)
      // Fixture date is 2025-01-01T00:00:01Z which is midnight UTC = 7 PM EST previous day
      expect(timeCell).toHaveTextContent('Dec 31, 2024 7:00:01 PM EST');

      // Switch to Monitor timezone
      const timezoneButton = screen.getByRole('button', {name: /Date Display/i});
      await userEvent.click(timezoneButton);
      await userEvent.click(screen.getByRole('option', {name: 'Monitor'}));

      // Monitor timezone (LA/PST UTC-8) - midnight UTC = 4 PM PST previous day
      const monitorTimezoneText = timeCell.textContent;
      expect(monitorTimezoneText).toBe('Dec 31, 2024 4:00:01 PM PST');

      // Switch to UTC
      await userEvent.click(timezoneButton);
      await userEvent.click(screen.getByRole('option', {name: 'UTC'}));

      // UTC should show the raw UTC time
      const utcTimezoneText = timeCell.textContent;
      expect(utcTimezoneText).toBe('Jan 1, 2025 12:00:01 AM UTC');
    });
  });
});
