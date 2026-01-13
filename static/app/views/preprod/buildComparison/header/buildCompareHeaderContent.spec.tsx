import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreprodBuildDetailsWithSizeInfoFixture} from 'sentry-fixture/preprod';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {MetricsArtifactType} from 'sentry/views/preprod/types/appSizeTypes';
import {BuildDetailsSizeAnalysisState} from 'sentry/views/preprod/types/buildDetailsTypes';

import {BuildCompareHeaderContent} from './buildCompareHeaderContent';

describe('BuildCompareHeaderContent', () => {
  const organization = OrganizationFixture({slug: 'test-org'});

  it('renders breadcrumbs with correct links using projectId', () => {
    const buildDetails = PreprodBuildDetailsWithSizeInfoFixture(
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
        app_info: {
          version: '3.10',
          build_number: '100',
          name: 'Test App',
          app_id: 'com.test.app',
          artifact_type: null,
          build_configuration: null,
          date_added: undefined,
          date_built: null,
          platform: 'ios',
        },
      }
    );

    render(<BuildCompareHeaderContent buildDetails={buildDetails} projectId="123456" />, {
      organization,
    });

    const releasesLink = screen.getByRole('link', {name: 'Releases'});
    expect(releasesLink).toHaveAttribute(
      'href',
      '/organizations/test-org/explore/releases/?project=123456&tab=mobile-builds'
    );

    const versionLink = screen.getByRole('link', {name: '3.10'});
    expect(versionLink).toHaveAttribute(
      'href',
      '/organizations/test-org/explore/releases/?project=123456&tab=mobile-builds&query=3.10'
    );

    expect(screen.queryByRole('link', {name: 'Compare'})).not.toBeInTheDocument();
    expect(screen.getByText('Compare')).toBeInTheDocument();
  });

  it('renders breadcrumbs without version when version is not present', () => {
    const buildDetails = PreprodBuildDetailsWithSizeInfoFixture(
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
        app_info: {
          version: '',
          build_number: '100',
          name: 'Test App',
          app_id: 'com.test.app',
          artifact_type: null,
          build_configuration: null,
          date_added: undefined,
          date_built: null,
          platform: 'ios',
        },
      }
    );

    render(<BuildCompareHeaderContent buildDetails={buildDetails} projectId="123456" />, {
      organization,
    });

    const releasesLink = screen.getByRole('link', {name: 'Releases'});
    expect(releasesLink).toHaveAttribute(
      'href',
      '/organizations/test-org/explore/releases/?project=123456&tab=mobile-builds'
    );

    expect(screen.queryByRole('link', {name: /^\d+\.\d+/})).not.toBeInTheDocument();
    expect(screen.getByText('Compare')).toBeInTheDocument();
  });
});
