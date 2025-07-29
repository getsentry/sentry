import {AutomationFixture} from 'sentry-fixture/automations';
import {
  MetricDetectorFixture,
  SnubaQueryDataSourceFixture,
} from 'sentry-fixture/detectors';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import DetectorDetails from 'sentry/views/detectors/detail';

describe('DetectorDetails', function () {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});
  const project = ProjectFixture();
  const defaultDataSource = SnubaQueryDataSourceFixture();
  const ownerTeam = TeamFixture();
  const dataSource = SnubaQueryDataSourceFixture({
    queryObj: {
      ...defaultDataSource.queryObj!,
      snubaQuery: {
        ...defaultDataSource.queryObj!.snubaQuery,
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
      url: '/organizations/org-slug/issues/?limit=5&query=is%3Aunresolved%20detector%3A1&statsPeriod=9998m',
      body: [GroupFixture()],
    });
  });

  describe('metric detectors', function () {
    const snubaQueryDetector = MetricDetectorFixture({
      id: '1',
      projectId: project.id,
      dataSources: [dataSource],
      owner: `team:${ownerTeam.id}`,
      workflowIds: ['1', '2'], // Add workflow IDs for connected automations
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/detectors/${snubaQueryDetector.id}/`,
        body: snubaQueryDetector,
      });
    });

    it('renders the detector details and snuba query', async function () {
      render(<DetectorDetails />, {
        organization,
        initialRouterConfig,
      });

      expect(
        await screen.findByRole('heading', {name: snubaQueryDetector.name})
      ).toBeInTheDocument();
      // Displays the snuba query
      expect(screen.getByText(dataSource.queryObj!.snubaQuery.query)).toBeInTheDocument();
      // Displays the environment
      expect(
        screen.getByText(dataSource.queryObj!.snubaQuery.environment!)
      ).toBeInTheDocument();
      // Displays the owner team
      expect(screen.getByText(`Assign to #${ownerTeam.slug}`)).toBeInTheDocument();
    });

    it('can edit the detector when the user has alerts:write access', async function () {
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

    it('disables the edit button when the user does not have alerts:write access', async function () {
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

    describe('connected automations', function () {
      it('displays empty message when no automations are connected', async function () {
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

      it('displays connected automations', async function () {
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

    it('displays ongoing issues for the detector', async function () {
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
});
