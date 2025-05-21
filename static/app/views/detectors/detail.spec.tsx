import {DetectorDataSourceFixture, DetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import DetectorDetails from 'sentry/views/detectors/detail';

describe('DetectorDetails', function () {
  const organization = OrganizationFixture({features: ['workflow-engine-ui']});
  const project = ProjectFixture();
  const defaultDataSource = DetectorDataSourceFixture();
  const subaQueryDetector = DetectorFixture({
    projectId: project.id,
    dataSources: [
      DetectorDataSourceFixture({
        queryObj: {
          ...defaultDataSource.queryObj,
          snubaQuery: {
            ...defaultDataSource.queryObj.snubaQuery,
            query: 'test',
            environment: 'test-environment',
          },
        },
      }),
    ],
  });
  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/detectors/${subaQueryDetector.id}/`,
    },
    route: '/organizations/:orgId/issues/detectors/:detectorId/',
  };

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/detectors/${subaQueryDetector.id}/`,
      body: subaQueryDetector,
    });
  });

  it('renders the detector name and snuba query', async function () {
    render(<DetectorDetails />, {
      organization,
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('heading', {name: subaQueryDetector.name})
    ).toBeInTheDocument();
    // Displays the snuba query
    expect(
      screen.getByText(subaQueryDetector.dataSources[0]!.queryObj.snubaQuery.query)
    ).toBeInTheDocument();
    // Displays the environment
    expect(
      screen.getByText(subaQueryDetector.dataSources[0]!.queryObj.snubaQuery.environment!)
    ).toBeInTheDocument();
  });
});
