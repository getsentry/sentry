import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {
  PreprodBuildDetailsWithSizeInfoFixture,
  PreprodVcsInfoFullFixture,
} from 'sentry-fixture/preprod';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricsArtifactType} from 'sentry/views/preprod/types/appSizeTypes';
import {BuildDetailsSizeAnalysisState} from 'sentry/views/preprod/types/buildDetailsTypes';

import {EventPreprodBuildInfo} from './eventPreprodBuildInfo';

describe('EventPreprodBuildInfo', () => {
  const organization = OrganizationFixture();

  const BUILD_DETAILS_URL =
    '/organizations/org-slug/preprodartifacts/artifact-123/build-details/';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns nothing when evidenceData has no headArtifactId', () => {
    const event = EventFixture({occurrence: null});
    const {container} = render(<EventPreprodBuildInfo event={event} />, {organization});
    expect(container).toBeEmptyDOMElement();
  });

  it('returns nothing when occurrence is missing', () => {
    const event = EventFixture();
    const {container} = render(<EventPreprodBuildInfo event={event} />, {organization});
    expect(container).toBeEmptyDOMElement();
  });

  it('renders build metadata rows when API returns data', async () => {
    const event = EventFixture({
      occurrence: {
        evidenceData: {headArtifactId: 'artifact-123'},
      } as any,
    });

    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      body: PreprodBuildDetailsWithSizeInfoFixture(
        {
          state: BuildDetailsSizeAnalysisState.COMPLETED,
          size_metrics: [
            {
              metrics_artifact_type: MetricsArtifactType.MAIN_ARTIFACT,
              install_size_bytes: 50_000_000,
              download_size_bytes: 25_000_000,
            },
          ],
          base_size_metrics: [],
        },
        {
          app_info: {
            version: '1.0.0',
            build_number: '123',
            name: 'Test App',
            platform: 'apple',
          },
          base_artifact_id: 'base-artifact-1',
          base_build_info: {
            version: '0.9.0',
            build_number: '120',
          },
          vcs_info: PreprodVcsInfoFullFixture(),
        }
      ),
    });

    render(<EventPreprodBuildInfo event={event} />, {
      organization,
    });

    expect(await screen.findByText('v1.0.0 (123)')).toBeInTheDocument();
    expect(screen.getByText('v0.9.0 (120)')).toBeInTheDocument();
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.getByText('50 MB')).toBeInTheDocument();
    expect(screen.getByText('25 MB')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('def456')).toBeInTheDocument();
    expect(screen.getByText('feature-branch')).toBeInTheDocument();
    expect(screen.getByText('#42')).toBeInTheDocument();
    expect(screen.getByText('test/repo')).toBeInTheDocument();
  });

  it('uses platform-specific labels for Android', async () => {
    const event = EventFixture({
      occurrence: {
        evidenceData: {headArtifactId: 'artifact-123'},
      } as any,
    });

    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      body: PreprodBuildDetailsWithSizeInfoFixture(
        {
          state: BuildDetailsSizeAnalysisState.COMPLETED,
          size_metrics: [
            {
              metrics_artifact_type: MetricsArtifactType.MAIN_ARTIFACT,
              install_size_bytes: 50_000_000,
              download_size_bytes: 25_000_000,
            },
          ],
          base_size_metrics: [],
        },
        {
          app_info: {
            version: '1.0.0',
            build_number: '123',
            name: 'Test App',
            platform: 'android',
          },
          vcs_info: PreprodVcsInfoFullFixture(),
        }
      ),
    });

    render(<EventPreprodBuildInfo event={event} />, {
      organization,
    });

    expect(await screen.findByText('Android')).toBeInTheDocument();
    expect(screen.getByText('Uncompressed Size')).toBeInTheDocument();
    expect(screen.getByText('Download Size')).toBeInTheDocument();
  });

  it('renders linked values for build and VCS info', async () => {
    const event = EventFixture({
      occurrence: {
        evidenceData: {headArtifactId: 'artifact-123'},
      } as any,
    });

    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      body: PreprodBuildDetailsWithSizeInfoFixture(
        {
          state: BuildDetailsSizeAnalysisState.COMPLETED,
          size_metrics: [],
          base_size_metrics: [],
        },
        {
          base_artifact_id: 'base-artifact-1',
          base_build_info: {
            version: '0.9.0',
            build_number: '120',
          },
          vcs_info: PreprodVcsInfoFullFixture(),
        }
      ),
    });

    render(<EventPreprodBuildInfo event={event} />, {
      organization,
    });

    // Build link is internal
    const buildLink = await screen.findByRole('link', {name: 'v1.0.0 (123)'});
    expect(buildLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/preprod/size/artifact-123/'
    );

    // Base build link is internal
    const baseBuildLink = screen.getByRole('link', {name: 'v0.9.0 (120)'});
    expect(baseBuildLink).toHaveAttribute(
      'href',
      '/organizations/org-slug/preprod/size/base-artifact-1/'
    );

    // SHA link is external
    const shaLink = screen.getByRole('link', {name: 'abc123'});
    expect(shaLink).toHaveAttribute('href', 'https://github.com/test/repo/commit/abc123');

    // Base SHA link is external
    const baseShaLink = screen.getByRole('link', {name: 'def456'});
    expect(baseShaLink).toHaveAttribute(
      'href',
      'https://github.com/test/repo/commit/def456'
    );

    // Branch link is external
    const branchLink = screen.getByRole('link', {name: 'feature-branch'});
    expect(branchLink).toHaveAttribute(
      'href',
      'https://github.com/test/repo/tree/feature-branch'
    );

    // PR link is external
    const prLink = screen.getByRole('link', {name: '#42'});
    expect(prLink).toHaveAttribute('href', 'https://github.com/test/repo/pull/42');

    // Repo link is external
    const repoLink = screen.getByRole('link', {name: 'test/repo'});
    expect(repoLink).toHaveAttribute('href', 'https://github.com/test/repo');
  });

  it('handles missing VCS fields gracefully by omitting rows', async () => {
    const event = EventFixture({
      occurrence: {
        evidenceData: {headArtifactId: 'artifact-123'},
      } as any,
    });

    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      body: PreprodBuildDetailsWithSizeInfoFixture(
        {
          state: BuildDetailsSizeAnalysisState.COMPLETED,
          size_metrics: [],
          base_size_metrics: [],
        },
        {
          vcs_info: {
            head_sha: null,
            head_ref: null,
            head_repo_name: null,
            base_sha: null,
            base_ref: null,
            base_repo_name: null,
            pr_number: null,
            provider: null,
          },
        }
      ),
    });

    render(<EventPreprodBuildInfo event={event} />, {
      organization,
    });

    // Build row should still render (from app_info)
    expect(await screen.findByText('v1.0.0 (123)')).toBeInTheDocument();

    // VCS rows should not be present
    expect(screen.queryByText('SHA')).not.toBeInTheDocument();
    expect(screen.queryByText('Branch')).not.toBeInTheDocument();
    expect(screen.queryByText('PR')).not.toBeInTheDocument();
    expect(screen.queryByText('Repo')).not.toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    const event = EventFixture({
      occurrence: {
        evidenceData: {headArtifactId: 'artifact-123'},
      } as any,
    });

    MockApiClient.addMockResponse({
      url: BUILD_DETAILS_URL,
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
    });

    render(<EventPreprodBuildInfo event={event} />, {
      organization,
    });

    expect(await screen.findByText('Failed to load build info.')).toBeInTheDocument();
  });
});
