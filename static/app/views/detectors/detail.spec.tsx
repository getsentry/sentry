import {AutomationFixture} from 'sentry-fixture/automations';
import {DetectorFixture, SnubaQueryDataSourceFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
  const snubaQueryDetector = DetectorFixture({
    projectId: project.id,
    dataSources: [dataSource],
    owner: `team:${ownerTeam.id}`,
    workflowIds: ['1', '2'], // Add workflow IDs for connected automations
  });
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/detectors/${snubaQueryDetector.id}/`,
    },
    route: '/organizations/:orgId/issues/detectors/:detectorId/',
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    TeamStore.loadInitialData([ownerTeam]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${snubaQueryDetector.id}/`,
      body: snubaQueryDetector,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [
        AutomationFixture({id: '1', name: 'Automation 1'}),
        AutomationFixture({id: '2', name: 'Automation 2'}),
      ],
      match: [MockApiClient.matchQuery({id: ['1', '2']})],
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
});
