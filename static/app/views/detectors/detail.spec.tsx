import {DetectorFixture, SnubaQueryDataSourceFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import DetectorDetails from 'sentry/views/detectors/detail';

describe('DetectorDetails', function () {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});
  const project = ProjectFixture();
  const defaultDataSource = SnubaQueryDataSourceFixture();
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
  });
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/detectors/${snubaQueryDetector.id}/`,
    },
    route: '/organizations/:orgId/issues/detectors/:detectorId/',
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${snubaQueryDetector.id}/`,
      body: snubaQueryDetector,
    });
  });

  it('renders the detector name and snuba query', async function () {
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
  });
});
