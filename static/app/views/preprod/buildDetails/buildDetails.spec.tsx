import {OrganizationFixture} from 'sentry-fixture/organization';
import {
  PreprodAppInfoFixture,
  PreprodBuildDetailsWithSizeInfoFixture,
  PreprodVcsInfoFullFixture,
} from 'sentry-fixture/preprod';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {MetricsArtifactType} from 'sentry/views/preprod/types/appSizeTypes';
import {BuildDetailsSizeAnalysisState} from 'sentry/views/preprod/types/buildDetailsTypes';

import BuildDetails from './buildDetails';

describe('BuildDetails', () => {
  const organization = OrganizationFixture();

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/preprod/size/artifact-1/`,
      query: {
        project: 'project-1',
      },
    },
    route: '/organizations/:orgId/preprod/size/:artifactId/',
  };

  const BUILD_DETAILS_URL =
    '/organizations/org-slug/preprodartifacts/artifact-1/build-details/';
  const SIZE_ANALYSIS_URL =
    '/organizations/org-slug/files/preprodartifacts/artifact-1/size-analysis/';
  const QUOTA_STATE_URL = '/organizations/org-slug/preprod/quota/';

  const createMockSizeAnalysisData = () => ({
    treemap: {
      root: {name: 'root', size: 1024000, children: []},
      category_breakdown: {},
    },
    insights: [],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    // Default quota state mock - quotas available
    MockApiClient.addMockResponse({
      url: QUOTA_STATE_URL,
      method: 'GET',
      body: {hasSizeQuota: true, hasDistributionQuota: true},
    });
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

    expect(screen.getByRole('complementary')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {name: 'artifact-1', level: 1})
    ).toBeInTheDocument();

    const loadingPlaceholders = screen.getAllByTestId('loading-placeholder');
    expect(loadingPlaceholders.length).toBeGreaterThan(0);
  });

  it('shows error state when build details query fails', async () => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: QUOTA_STATE_URL,
      method: 'GET',
      body: {hasSizeQuota: true, hasDistributionQuota: true},
    });

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

  it.each(['1.0.0', undefined])(
    'shows the loaded header with version %s',
    async version => {
      MockApiClient.clearMockResponses();

      MockApiClient.addMockResponse({
        url: QUOTA_STATE_URL,
        method: 'GET',
        body: {hasSizeQuota: true, hasDistributionQuota: true},
      });

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
            app_info: PreprodAppInfoFixture({version}),
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

      expect(
        await screen.findByRole('heading', {name: 'artifact-1', level: 1})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', {
          name: version
            ? 'Build version, v1.0.0 (123)'
            : 'Build version, Unknown version',
          level: 2,
        })
      ).toBeInTheDocument();
      expect(await screen.findByText('Build Metadata')).toBeInTheDocument();
    }
  );

  it('enables Install once the build reports itself installable', async () => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: QUOTA_STATE_URL,
      method: 'GET',
      body: {hasSizeQuota: true, hasDistributionQuota: true},
    });

    const installable = PreprodBuildDetailsWithSizeInfoFixture({
      state: BuildDetailsSizeAnalysisState.COMPLETED,
      size_metrics: [],
      base_size_metrics: [],
    });

    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      method: 'GET',
      body: {
        ...installable,
        distribution_info: {...installable.distribution_info, is_installable: true},
      },
    });

    MockApiClient.addMockResponse({
      url: SIZE_ANALYSIS_URL,
      method: 'GET',
      body: createMockSizeAnalysisData(),
    });

    render(<BuildDetails />, {organization, initialRouterConfig});

    await userEvent.click(await screen.findByRole('button', {name: 'Build Actions'}));

    expect(
      await screen.findByRole('menuitemradio', {name: 'Install'})
    ).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the app metadata in the entity header and the actions in the more menu', async () => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: QUOTA_STATE_URL,
      method: 'GET',
      body: {hasSizeQuota: true, hasDistributionQuota: true},
    });

    MockApiClient.addMockResponse({
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
          app_info: PreprodAppInfoFixture({
            name: 'Test App',
            app_id: 'com.example.app',
            build_configuration: 'release',
            platform: 'android',
          }),
          vcs_info: PreprodVcsInfoFullFixture(),
        }
      ),
    });

    MockApiClient.addMockResponse({
      url: SIZE_ANALYSIS_URL,
      method: 'GET',
      body: createMockSizeAnalysisData(),
    });

    const {router} = render(<BuildDetails />, {
      organization,
      initialRouterConfig,
    });

    // Metadata that used to live in the sidebar aside now sits in the header.
    const metadata = await screen.findByRole('list', {name: 'Build properties'});
    expect(await within(metadata).findByText('Test App')).toBeInTheDocument();
    expect(within(metadata).getByText('com.example.app')).toBeInTheDocument();
    expect(screen.getByText('release')).toBeInTheDocument();

    // Both kept the tooltip that explained them in the sidebar. The app id's
    // copy doubles as its visually hidden key, so match the portalled one.
    await userEvent.hover(within(metadata).getByText('com.example.app'));
    await waitFor(() => {
      expect(
        screen.getAllByText('Package name').some(node => !metadata.contains(node))
      ).toBe(true);
    });

    await userEvent.hover(screen.getByText('release'));
    expect(await screen.findByText('Build configuration')).toBeInTheDocument();

    // The platform graphic names both what it is and what it shows.
    await userEvent.hover(screen.getByRole('img', {name: 'Platform, Android'}));
    expect(await screen.findByText('Platform, Android')).toBeInTheDocument();

    // The actions are no longer standalone buttons in the topbar.
    expect(screen.queryByRole('button', {name: 'Compare Build'})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Build Actions'}));

    expect(
      await screen.findByRole('menuitemradio', {name: 'Compare Build'})
    ).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'Delete Build'})).toBeInTheDocument();

    // The fixture is not installable, so Install is offered but inert rather
    // than opening a modal with nothing behind it.
    expect(screen.getByRole('menuitemradio', {name: 'Install'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );

    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Compare Build'}));

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/organizations/${organization.slug}/preprod/size/compare/artifact-1/`
      );
    });
  });

  it('prefers build_number_raw over the synthesized build_number', async () => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: QUOTA_STATE_URL,
      method: 'GET',
      body: {hasSizeQuota: true, hasDistributionQuota: true},
    });

    MockApiClient.addMockResponse({
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
          app_info: PreprodAppInfoFixture({
            build_number: '1000002000003',
            build_number_raw: '1.2.3',
          }),
          vcs_info: PreprodVcsInfoFullFixture(),
        }
      ),
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

    expect(await screen.findByText('v1.0.0 (1.2.3)')).toBeInTheDocument();
    expect(screen.queryByText('v1.0.0 (1000002000003)')).not.toBeInTheDocument();
  });

  it('shows "Your app is still being analyzed..." text when size analysis is processing', async () => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: QUOTA_STATE_URL,
      method: 'GET',
      body: {hasSizeQuota: true, hasDistributionQuota: true},
    });

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
    jest.useFakeTimers();

    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: QUOTA_STATE_URL,
      method: 'GET',
      body: {hasSizeQuota: true, hasDistributionQuota: true},
    });

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

    // Advance past the 10s refetchInterval to trigger the polling refetch
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    await waitFor(() => expect(buildDetailsMock).toHaveBeenCalledTimes(2));

    // After the state transition, size analysis should be refetched
    await waitFor(() => expect(appSizeMock).toHaveBeenCalledTimes(2));

    jest.useRealTimers();
  });

  it('does not refetch size analysis when size_info remains in completed state', async () => {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: QUOTA_STATE_URL,
      method: 'GET',
      body: {hasSizeQuota: true, hasDistributionQuota: true},
    });

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
    jest.useFakeTimers();

    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: QUOTA_STATE_URL,
      method: 'GET',
      body: {hasSizeQuota: true, hasDistributionQuota: true},
    });

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
    // First call returns PENDING state - shows queued message
    expect(await screen.findByText('Queued for analysis')).toBeInTheDocument();

    // Advance past the 10s refetchInterval to trigger the polling refetch
    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    await waitFor(() => expect(buildDetailsMock).toHaveBeenCalledTimes(2));

    // Second call returns PROCESSING state - shows processing message
    expect(await screen.findByText('Running size analysis')).toBeInTheDocument();

    // Size analysis should not be refetched since we're still processing
    expect(appSizeMock).toHaveBeenCalledTimes(1);

    jest.useRealTimers();
  });

  describe('quota warning banner', () => {
    it('does not show warning banner when quotas are available', async () => {
      MockApiClient.addMockResponse({
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

      MockApiClient.addMockResponse({
        url: SIZE_ANALYSIS_URL,
        method: 'GET',
        body: createMockSizeAnalysisData(),
      });

      render(<BuildDetails />, {
        organization,
        initialRouterConfig,
      });

      await screen.findByText('v1.0.0 (123)');

      expect(
        screen.queryByText("You've exceeded your size analysis quota.")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText("You've exceeded your build distribution quota.")
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(
          "You've exceeded your size analysis and build distribution quota."
        )
      ).not.toBeInTheDocument();
    });

    it('shows warning banner when size quota is exceeded', async () => {
      MockApiClient.addMockResponse({
        url: QUOTA_STATE_URL,
        method: 'GET',
        body: {hasSizeQuota: false, hasDistributionQuota: true},
      });

      MockApiClient.addMockResponse({
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

      MockApiClient.addMockResponse({
        url: SIZE_ANALYSIS_URL,
        method: 'GET',
        body: createMockSizeAnalysisData(),
      });

      render(<BuildDetails />, {
        organization,
        initialRouterConfig,
      });

      expect(
        await screen.findByText(/You've exceeded your Size Analysis quota/)
      ).toBeInTheDocument();
    });

    it('shows warning banner when distribution quota is exceeded', async () => {
      MockApiClient.addMockResponse({
        url: QUOTA_STATE_URL,
        method: 'GET',
        body: {hasSizeQuota: true, hasDistributionQuota: false},
      });

      MockApiClient.addMockResponse({
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

      MockApiClient.addMockResponse({
        url: SIZE_ANALYSIS_URL,
        method: 'GET',
        body: createMockSizeAnalysisData(),
      });

      render(<BuildDetails />, {
        organization,
        initialRouterConfig,
      });

      expect(
        await screen.findByText(/You've exceeded your Build Distribution quota/)
      ).toBeInTheDocument();
    });

    it('shows warning banner when both quotas are exceeded', async () => {
      MockApiClient.addMockResponse({
        url: QUOTA_STATE_URL,
        method: 'GET',
        body: {hasSizeQuota: false, hasDistributionQuota: false},
      });

      MockApiClient.addMockResponse({
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

      MockApiClient.addMockResponse({
        url: SIZE_ANALYSIS_URL,
        method: 'GET',
        body: createMockSizeAnalysisData(),
      });

      render(<BuildDetails />, {
        organization,
        initialRouterConfig,
      });

      expect(
        await screen.findByText(
          /You've exceeded your Size Analysis and Build Distribution quota/
        )
      ).toBeInTheDocument();
    });
  });
});
