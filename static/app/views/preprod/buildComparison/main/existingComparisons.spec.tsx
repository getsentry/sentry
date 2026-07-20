import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreprodBuildDetailsWithSizeInfoFixture} from 'sentry-fixture/preprod';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as analytics from 'sentry/utils/analytics';
import {MetricsArtifactType} from 'sentry/views/preprod/types/appSizeTypes';
import {
  BuildDetailsSizeAnalysisState,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';

import {ExistingComparisons} from './existingComparisons';

const organization = OrganizationFixture();
const HEAD_ID = 'head-1';
const COMPARISONS_URL = `/organizations/${organization.slug}/preprodartifacts/${HEAD_ID}/size-analysis/comparisons/`;

function makeBuild({
  downloadBytes,
  id,
  installBytes,
  version,
}: {
  downloadBytes: number;
  id: string;
  installBytes: number;
  version: string;
}): BuildDetailsApiResponse {
  return PreprodBuildDetailsWithSizeInfoFixture(
    {
      state: BuildDetailsSizeAnalysisState.COMPLETED,
      size_metrics: [
        {
          metrics_artifact_type: MetricsArtifactType.MAIN_ARTIFACT,
          install_size_bytes: installBytes,
          download_size_bytes: downloadBytes,
        },
      ],
      base_size_metrics: [],
    },
    {id, app_info: {version}}
  );
}

// The page's head build: 10 MB install / 5 MB download. Deltas below are head - base.
const headBuild = makeBuild({
  id: HEAD_ID,
  version: '3.0.0',
  installBytes: 10_000_000,
  downloadBytes: 5_000_000,
});

describe('ExistingComparisons', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders a row per comparison with head-vs-base size deltas', async () => {
    MockApiClient.addMockResponse({
      url: COMPARISONS_URL,
      method: 'GET',
      body: {
        comparisons: [
          // Base smaller than head -> head grew (+).
          makeBuild({
            id: 'base-1',
            version: '2.0.0',
            installBytes: 8_000_000,
            downloadBytes: 4_000_000,
          }),
          // Base larger than head -> head shrank (-).
          makeBuild({
            id: 'base-2',
            version: '1.5.0',
            installBytes: 13_000_000,
            downloadBytes: 9_000_000,
          }),
        ],
      },
    });

    render(<ExistingComparisons headBuildDetails={headBuild} />, {organization});

    expect(await screen.findByText('v2.0.0')).toBeInTheDocument();
    expect(screen.getByText('v1.5.0')).toBeInTheDocument();

    // Deltas shown inline next to each base's install/download sizes.
    expect(screen.getByText('+2 MB')).toBeInTheDocument(); // install: 10 - 8
    expect(screen.getByText('+1 MB')).toBeInTheDocument(); // download: 5 - 4
    expect(screen.getByText('-3 MB')).toBeInTheDocument(); // install: 10 - 13
    expect(screen.getByText('-4 MB')).toBeInTheDocument(); // download: 5 - 9
  });

  it('links each comparison to its compare page', async () => {
    MockApiClient.addMockResponse({
      url: COMPARISONS_URL,
      method: 'GET',
      body: {
        comparisons: [
          makeBuild({
            id: 'base-1',
            version: '2.0.0',
            installBytes: 8_000_000,
            downloadBytes: 4_000_000,
          }),
        ],
      },
    });

    render(<ExistingComparisons headBuildDetails={headBuild} />, {organization});

    const link = await screen.findByRole('link', {name: /v2\.0\.0/});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/preprod/size/compare/${HEAD_ID}/base-1/`
    );
  });

  it('renders nothing when there are no comparisons', async () => {
    const mock = MockApiClient.addMockResponse({
      url: COMPARISONS_URL,
      method: 'GET',
      body: {comparisons: []},
    });

    render(<ExistingComparisons headBuildDetails={headBuild} />, {organization});

    await waitFor(() => expect(mock).toHaveBeenCalled());
    expect(screen.queryByText('Existing Comparisons')).not.toBeInTheDocument();
  });

  it('renders nothing when the request fails', async () => {
    const mock = MockApiClient.addMockResponse({
      url: COMPARISONS_URL,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Internal Error'},
    });

    render(<ExistingComparisons headBuildDetails={headBuild} />, {organization});

    await waitFor(() => expect(mock).toHaveBeenCalled());
    expect(screen.queryByText('Existing Comparisons')).not.toBeInTheDocument();
  });

  it('applies the search query to the comparisons request', async () => {
    MockApiClient.addMockResponse({
      url: COMPARISONS_URL,
      method: 'GET',
      match: [MockApiClient.matchQuery({query: 'acme'})],
      body: {
        comparisons: [
          makeBuild({
            id: 'base-1',
            version: '2.0.0',
            installBytes: 8_000_000,
            downloadBytes: 4_000_000,
          }),
        ],
      },
    });

    render(<ExistingComparisons headBuildDetails={headBuild} searchQuery="acme" />, {
      organization,
    });

    // The row only renders if the request carried query=acme and matched the mock.
    expect(await screen.findByText('v2.0.0')).toBeInTheDocument();
  });

  it('tracks an analytics event when a comparison is opened', async () => {
    const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');
    MockApiClient.addMockResponse({
      url: COMPARISONS_URL,
      method: 'GET',
      body: {
        comparisons: [
          makeBuild({
            id: 'base-1',
            version: '2.0.0',
            installBytes: 8_000_000,
            downloadBytes: 4_000_000,
          }),
        ],
      },
    });

    render(<ExistingComparisons headBuildDetails={headBuild} />, {organization});

    await userEvent.click(await screen.findByRole('link', {name: /v2\.0\.0/}));

    expect(analyticsSpy).toHaveBeenCalledWith(
      'preprod.builds.compare.open_existing_comparison',
      expect.objectContaining({build_id: 'base-1'})
    );
  });
});
