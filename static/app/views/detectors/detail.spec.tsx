import {ActorFixture} from 'sentry-fixture/actor';
import {AutomationFixture} from 'sentry-fixture/automations';
import {
  CronDetectorFixture,
  CronMonitorDataSourceFixture,
  CronMonitorEnvironmentFixture,
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
  UptimeDetectorFixture,
} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UptimeCheckFixture} from 'sentry-fixture/uptimeCheck';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import {CheckStatus} from 'sentry/views/alerts/rules/uptime/types';
import DetectorDetails from 'sentry/views/detectors/detail';

describe('DetectorDetails', () => {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});
  const project = ProjectFixture();
  const defaultDataSource = SnubaQueryDataSourceFixture();
  const ownerTeam = TeamFixture();
  const dataSource = SnubaQueryDataSourceFixture({
    queryObj: {
      ...defaultDataSource.queryObj,
      snubaQuery: {
        ...defaultDataSource.queryObj.snubaQuery,
        query: 'test',
        environment: 'test-environment',
      },
    },
  });
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/detectors/1/`,
    },
    route: '/organizations/:orgId/issues/detectors/:detectorId/',
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    TeamStore.loadInitialData([ownerTeam]);
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [
        AutomationFixture({id: '1', name: 'Automation 1'}),
        AutomationFixture({id: '2', name: 'Automation 2'}),
      ],
      match: [MockApiClient.matchQuery({id: ['1', '2']})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/1/`,
      body: UserFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events-stats/`,
      body: {
        data: [
          [1543449600, [20, 12]],
          [1543449601, [10, 5]],
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?limit=5&query=is%3Aunresolved%20detector%3A1&statsPeriod=14d',
      body: [GroupFixture()],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/open-periods/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/1/`,
      body: GroupFixture(),
    });
  });

  describe('metric detectors', () => {
    const snubaQueryDetector = MetricDetectorFixture({
      id: '1',
      projectId: project.id,
      dataSources: [dataSource],
      owner: ActorFixture({id: ownerTeam.id, name: ownerTeam.slug, type: 'team'}),
      workflowIds: ['1', '2'], // Add workflow IDs for connected automations
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${snubaQueryDetector.id}/`,
        body: snubaQueryDetector,
      });

      // Metric detectors use different statsPeriod
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/?limit=5&query=is%3Aunresolved%20detector%3A1&statsPeriod=9998m',
        body: [GroupFixture()],
      });
    });

    it('renders the detector details and snuba query', async () => {
      render(<DetectorDetails />, {
        organization,
        initialRouterConfig,
      });

      expect(
        await screen.findByRole('heading', {name: snubaQueryDetector.name})
      ).toBeInTheDocument();
      // Displays the snuba query
      expect(screen.getByLabelText('event.type:error test')).toBeInTheDocument();
      // Displays the environment
      expect(
        screen.getByText(dataSource.queryObj.snubaQuery.environment!)
      ).toBeInTheDocument();
      // Displays the owner team
      expect(screen.getByText('Assign to')).toBeInTheDocument();
      expect(
        await screen.findByRole('link', {name: `#${ownerTeam.slug}`})
      ).toBeInTheDocument();
    });

    it('can edit the detector when the user has alerts:write access', async () => {
      const {router} = render(<DetectorDetails />, {
        organization,
        initialRouterConfig,
      });

      const editButton = await screen.findByRole('button', {name: 'Edit'});
      await userEvent.click(editButton);

      await waitFor(() => {
        expect(router.location.pathname).toBe(
          `/organizations/${organization.slug}/issues/monitors/${snubaQueryDetector.id}/edit/`
        );
      });
    });

    it('disables the edit button when the user does not have alerts:write access', async () => {
      const orgWithoutAlertsWrite = {
        ...organization,
        access: organization.access.filter(a => a !== 'alerts:write'),
      };
      ProjectsStore.loadInitialData([ProjectFixture({access: []})]);
      render(<DetectorDetails />, {
        organization: orgWithoutAlertsWrite,
        initialRouterConfig,
      });

      const editButton = await screen.findByRole('button', {name: 'Edit'});
      expect(editButton).toHaveAttribute('aria-disabled', 'true');
    });

    describe('connected automations', () => {
      it('displays empty message when no automations are connected', async () => {
        MockApiClient.addMockResponse({
          url: `/organizations/${organization.slug}/detectors/${snubaQueryDetector.id}/`,
          body: {
            ...snubaQueryDetector,
            workflowIds: [],
          },
        });
        render(<DetectorDetails />, {
          organization,
          initialRouterConfig,
        });
        expect(await screen.findByText('No automations connected')).toBeInTheDocument();
      });

      it('displays connected automations', async () => {
        render(<DetectorDetails />, {
          organization,
          initialRouterConfig,
        });

        // Verify both automations are displayed
        expect(await screen.findByText('Automation 1')).toBeInTheDocument();
        expect(await screen.findByText('Automation 2')).toBeInTheDocument();

        // Verify the table shows the correct columns
        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Last Triggered')).toBeInTheDocument();
        expect(screen.getByText('Actions')).toBeInTheDocument();
      });
    });

    it('displays ongoing issues for the detector', async () => {
      const {router} = render(<DetectorDetails />, {
        organization,
        initialRouterConfig,
      });

      // Verify ongoing issues section is displayed
      expect(await screen.findByText('RequestError')).toBeInTheDocument();

      // Verify the View All button links to the issues page with the correct query
      const viewAllButton = screen.getByRole('button', {name: 'View All'});

      await userEvent.click(viewAllButton);

      // Check that navigation occurred to the issues page with the detector query
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/issues/`
      );
      expect(router.location.query).toEqual(
        expect.objectContaining({
          query: `is:unresolved detector:${snubaQueryDetector.id}`,
        })
      );
    });
  });

  describe('uptime detectors', () => {
    const uptimeDetector = UptimeDetectorFixture({
      id: '1',
      projectId: project.id,
      owner: ActorFixture({id: ownerTeam.id, name: ownerTeam.slug, type: 'team'}),
      workflowIds: ['1', '2'], // Add workflow IDs for connected automations
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${uptimeDetector.id}/`,
        body: uptimeDetector,
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        method: 'GET',
        body: [],
      });

      // Mock uptime checks endpoint
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/uptime/${uptimeDetector.id}/checks/`,
        body: [
          UptimeCheckFixture({
            checkStatus: CheckStatus.SUCCESS,
            scheduledCheckTime: '2025-01-01T00:00:00Z',
            httpStatusCode: 200,
            durationMs: 150,
            regionName: 'US East',
          }),
          UptimeCheckFixture({
            checkStatus: CheckStatus.FAILURE,
            scheduledCheckTime: '2025-01-01T00:01:00Z',
            httpStatusCode: 500,
            durationMs: 5000,
            regionName: 'US West',
          }),
        ],
      });
    });

    it('displays correct detector details', async () => {
      render(<DetectorDetails />, {
        organization,
        initialRouterConfig,
      });

      expect(
        await screen.findByRole('heading', {name: uptimeDetector.name})
      ).toBeInTheDocument();

      expect(screen.getByText('Three consecutive failed checks.')).toBeInTheDocument();
      expect(
        screen.getByText('Three consecutive successful checks.')
      ).toBeInTheDocument();

      // Interval
      expect(screen.getByText('Every 1 minute')).toBeInTheDocument();
      // URL
      expect(screen.getByText('https://example.com')).toBeInTheDocument();
      // Method
      expect(screen.getByText('GET')).toBeInTheDocument();
      // Environment
      expect(screen.getByText('production')).toBeInTheDocument();

      // Connected automation
      expect(await screen.findByText('Automation 1')).toBeInTheDocument();

      // Edit button takes you to the edit page
      expect(screen.getByRole('button', {name: 'Edit'})).toHaveAttribute(
        'href',
        '/organizations/org-slug/issues/monitors/1/edit/'
      );
    });

    it('displays the check-in table with correct data', async () => {
      render(<DetectorDetails />, {
        organization,
        initialRouterConfig,
      });

      expect(await screen.findByText('Recent Check-Ins')).toBeInTheDocument();

      // Verify check-in data is displayed
      expect(screen.getAllByText('Uptime')).toHaveLength(2); // timeline legend + check-in row
      expect(screen.getByText('200')).toBeInTheDocument();
      expect(screen.getByText('US East')).toBeInTheDocument();
      expect(screen.getAllByText('Failure')).toHaveLength(2); // timeline legend + check-in row
      expect(screen.getByText('500')).toBeInTheDocument();
      expect(screen.getByText('US West')).toBeInTheDocument();
    });
  });

  describe('cron detectors', () => {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/monitors/test-monitor/checkins/',
        body: [],
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${cronDetector.id}/`,
        body: cronDetector,
      });
    });

    const cronMonitorDataSource = CronMonitorDataSourceFixture({
      queryObj: {
        ...CronMonitorDataSourceFixture().queryObj,
        environments: [
          CronMonitorEnvironmentFixture({
            lastCheckIn: '2017-10-17T01:41:20.000Z', // 1 hour ago
            nextCheckIn: '2017-10-17T03:41:20.000Z', // 1 hour in the future
          }),
        ],
      },
    });
    const cronDetector = CronDetectorFixture({
      id: '1',
      projectId: project.id,
      owner: ActorFixture({id: ownerTeam.id, name: ownerTeam.slug, type: 'team'}),
      workflowIds: ['1', '2'],
      dataSources: [cronMonitorDataSource],
    });

    it('displays correct detector details', async () => {
      render(<DetectorDetails />, {
        organization,
        initialRouterConfig,
      });

      expect(
        await screen.findByRole('heading', {name: cronDetector.name})
      ).toBeInTheDocument();

      // Failure threshold: 1
      expect(screen.getByText('One failed check-in.')).toBeInTheDocument();
      // Recovery threshold: 2
      expect(screen.getByText('2 consecutive successful check-ins.')).toBeInTheDocument();

      // Last check-in
      expect(screen.getByText('1 hour ago')).toBeInTheDocument();
      // Next check-in
      expect(screen.getByText('in 1 hour')).toBeInTheDocument();

      // Connected automation
      expect(await screen.findByText('Automation 1')).toBeInTheDocument();
    });
  });
});
