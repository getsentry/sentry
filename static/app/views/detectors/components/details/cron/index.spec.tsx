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

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
});
