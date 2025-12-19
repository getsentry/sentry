import {OrganizationFixture} from 'sentry-fixture/organization';
import {
  PreprodBuildDetailsWithSizeInfoFixture,
  PreprodVcsInfoFullFixture,
} from 'sentry-fixture/preprod';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {MetricsArtifactType} from 'sentry/views/preprod/types/appSizeTypes';
import {BuildDetailsSizeAnalysisState} from 'sentry/views/preprod/types/buildDetailsTypes';

import BuildDetails from './buildDetails';

describe('BuildDetails', () => {
  const organization = OrganizationFixture();

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/projects/project-1/preprod/artifacts/artifact-1/`,
    },
    route: '/organizations/:orgId/projects/:projectId/preprod/artifacts/:artifactId/',
  };

  const BUILD_DETAILS_URL = `/projects/org-slug/project-1/preprodartifacts/artifact-1/build-details/`;
  const SIZE_ANALYSIS_URL = `/projects/org-slug/project-1/files/preprodartifacts/artifact-1/size-analysis/`;

  const createMockSizeAnalysisData = () => ({
    treemap: {
      root: {name: 'root', size: 1024000, children: []},
      category_breakdown: {},
    },
    insights: [],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows loading skeletons when queries are pending', () => {
    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      body: new Promise(() => {}),
    });

    MockApiClient.addMockResponse({
      url: SIZE_ANALYSIS_URL,
      method: 'GET',
      body: new Promise(() => {}),
    });

    render(<BuildDetails />, {
      organization,
      initialRouterConfig,
    });

    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();

    const loadingPlaceholders = screen.getAllByTestId('loading-placeholder');
    expect(loadingPlaceholders.length).toBeGreaterThan(0);
  });

  it('shows error state when build details query fails', async () => {
    MockApiClient.clearMockResponses();

    const buildDetailsMock = MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Failed to load build details'},
    });

    MockApiClient.addMockResponse({
      url: SIZE_ANALYSIS_URL,
      method: 'GET',
      body: createMockSizeAnalysisData(),
    });

    render(<BuildDetails />, {
      organization,
      initialRouterConfig,
    });

    await waitFor(() => expect(buildDetailsMock).toHaveBeenCalledTimes(1));

    expect(await screen.findByText('Build details unavailable')).toBeInTheDocument();

    expect(screen.queryByText('Git details')).not.toBeInTheDocument();
    expect(screen.queryByText('Search files')).not.toBeInTheDocument();
  });

  it('shows success state when both queries succeed', async () => {
    MockApiClient.clearMockResponses();

    const buildDetailsMock = MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      body: PreprodBuildDetailsWithSizeInfoFixture(
        {
          state: BuildDetailsSizeAnalysisState.COMPLETED,
          size_metrics: [
            {
              metrics_artifact_type: MetricsArtifactType.MAIN_ARTIFACT,
              install_size_bytes: 1024000,
              download_size_bytes: 512000,
            },
          ],
          base_size_metrics: [],
        },
        {
          vcs_info: PreprodVcsInfoFullFixture(),
        }
      ),
    });

    const appSizeMock = MockApiClient.addMockResponse({
      url: SIZE_ANALYSIS_URL,
      method: 'GET',
      body: createMockSizeAnalysisData(),
    });

    render(<BuildDetails />, {
      organization,
      initialRouterConfig,
    });

    await waitFor(() => expect(buildDetailsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(appSizeMock).toHaveBeenCalledTimes(1));

    expect(await screen.findByText('v1.0.0 (123)')).toBeInTheDocument();
    expect(await screen.findByText('Build Metadata')).toBeInTheDocument();
  });

  it('shows "Your app is still being analyzed..." text when size analysis is processing', async () => {
    MockApiClient.clearMockResponses();

    const buildDetailsMock = MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      body: PreprodBuildDetailsWithSizeInfoFixture({
        state: BuildDetailsSizeAnalysisState.PROCESSING,
      }),
    });

    MockApiClient.addMockResponse({
      url: SIZE_ANALYSIS_URL,
      method: 'GET',
      body: new Promise(() => {}), // Keep pending
    });

    render(<BuildDetails />, {
      organization,
      initialRouterConfig,
    });

    await waitFor(() => expect(buildDetailsMock).toHaveBeenCalledTimes(1));

    expect(await screen.findByText('Running size analysis')).toBeInTheDocument();
  });

  it('refetches size analysis when size_info state transitions from processing to completed', async () => {
    MockApiClient.clearMockResponses();

    let callCount = 0;
    const buildDetailsMock = MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      body: () => {
        callCount++;
        if (callCount === 1) {
          return PreprodBuildDetailsWithSizeInfoFixture({
            state: BuildDetailsSizeAnalysisState.PROCESSING,
          });
        }
        return PreprodBuildDetailsWithSizeInfoFixture({
          state: BuildDetailsSizeAnalysisState.COMPLETED,
          size_metrics: [
            {
              metrics_artifact_type: MetricsArtifactType.MAIN_ARTIFACT,
              install_size_bytes: 1024000,
              download_size_bytes: 512000,
            },
          ],
          base_size_metrics: [],
        });
      },
    });

    const appSizeMock = MockApiClient.addMockResponse({
      url: SIZE_ANALYSIS_URL,
      method: 'GET',
      body: createMockSizeAnalysisData(),
    });

    render(<BuildDetails />, {
      organization,
      initialRouterConfig,
    });

    await waitFor(() => expect(buildDetailsMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Running size analysis')).toBeInTheDocument();

    // Size analysis should only be called once initially
    expect(appSizeMock).toHaveBeenCalledTimes(1);

    await waitFor(
      () => {
        expect(buildDetailsMock).toHaveBeenCalledTimes(2);
      },
      {timeout: 12000}
    );

    // After the state transition, size analysis should be refetched
    await waitFor(
      () => {
        expect(appSizeMock).toHaveBeenCalledTimes(2);
      },
      {timeout: 5000}
    );
  }, 20000);

  it('does not refetch size analysis when size_info remains in completed state', async () => {
    MockApiClient.clearMockResponses();

    const buildDetailsMock = MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      body: PreprodBuildDetailsWithSizeInfoFixture({
        state: BuildDetailsSizeAnalysisState.COMPLETED,
        size_metrics: [
          {
            metrics_artifact_type: MetricsArtifactType.MAIN_ARTIFACT,
            install_size_bytes: 1024000,
            download_size_bytes: 512000,
          },
        ],
        base_size_metrics: [],
      }),
    });

    const appSizeMock = MockApiClient.addMockResponse({
      url: SIZE_ANALYSIS_URL,
      method: 'GET',
      body: createMockSizeAnalysisData(),
    });

    const {rerender} = render(<BuildDetails />, {
      organization,
      initialRouterConfig,
    });

    await waitFor(() => expect(buildDetailsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(appSizeMock).toHaveBeenCalledTimes(1));

    rerender(<BuildDetails />);

    // Size analysis should not be refetched since it was already completed
    await waitFor(() => expect(appSizeMock).toHaveBeenCalledTimes(1));
  });

  it('does not refetch size analysis when size_info transitions from pending to processing', async () => {
    MockApiClient.clearMockResponses();

    let callCount = 0;
    const buildDetailsMock = MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      body: () => {
        callCount++;
        if (callCount === 1) {
          return PreprodBuildDetailsWithSizeInfoFixture({
            state: BuildDetailsSizeAnalysisState.PENDING,
          });
        }
        return PreprodBuildDetailsWithSizeInfoFixture({
          state: BuildDetailsSizeAnalysisState.PROCESSING,
        });
      },
    });

    const appSizeMock = MockApiClient.addMockResponse({
      url: SIZE_ANALYSIS_URL,
      method: 'GET',
      body: createMockSizeAnalysisData(),
    });

    render(<BuildDetails />, {
      organization,
      initialRouterConfig,
    });

    await waitFor(() => expect(buildDetailsMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Running size analysis')).toBeInTheDocument();

    await waitFor(
      () => {
        expect(buildDetailsMock).toHaveBeenCalledTimes(2);
      },
      {timeout: 12000}
    );

    // Still showing processing state (not completed yet)
    expect(screen.getByText('Running size analysis')).toBeInTheDocument();

    // Size analysis should not be refetched since we're still processing
    expect(appSizeMock).toHaveBeenCalledTimes(1);
  }, 20000);
});
