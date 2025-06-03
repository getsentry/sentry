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
      ...defaultDataSource.queryObj,
      snubaQuery: {
        ...defaultDataSource.queryObj.snubaQuery,
        query: 'test',
        environment: 'test-environment',
      },
    },
  });
  const snubaQueryDetector = DetectorFixture({
    projectId: project.id,
    dataSources: [dataSource],
    owner: `team:${ownerTeam.id}`,
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
    expect(screen.getByText(dataSource.queryObj.snubaQuery.query)).toBeInTheDocument();
    // Displays the environment
    expect(
      screen.getByText(dataSource.queryObj.snubaQuery.environment!)
    ).toBeInTheDocument();
    // Displays the owner team
    expect(screen.getByText(`Assign to #${ownerTeam.slug}`)).toBeInTheDocument();
  });
});
