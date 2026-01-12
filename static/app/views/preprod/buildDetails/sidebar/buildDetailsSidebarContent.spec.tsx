import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {BuildDetailsSidebarContent} from 'sentry/views/preprod/buildDetails/sidebar/buildDetailsSidebarContent';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {BuildDetailsState} from 'sentry/views/preprod/types/buildDetailsTypes';

const mockBuildDetailsData: BuildDetailsApiResponse = {
  id: '123',
  project_id: 1,
  project_slug: 'test-project',
  state: BuildDetailsState.PROCESSED,
  app_info: {
    app_id: 'com.example.app',
    name: 'Test App',
    version: '1.0.0',
    build_number: '100',
    platform: 'ios',
    artifact_type: 0,
    build_configuration: 'Release',
    date_built: '2023-01-01T00:00:00Z',
    date_added: '2023-01-01T00:00:00Z',
    is_installable: true,
  },
  distribution_info: {
    is_installable: true,
    download_count: 5,
    release_notes: 'Release notes',
  },
  vcs_info: {
    head_sha: 'abc123',
    base_sha: 'def456',
    head_ref: 'main',
    base_ref: 'master',
    head_repo_name: 'test-repo',
    base_repo_name: 'test-repo',
    pr_number: 123,
    provider: 'github',
  },
};

function TestComponent({
  artifactId,
  projectId,
  buildDetailsData,
  isBuildDetailsPending,
}: {
  artifactId: string;
  projectId: string;
  buildDetailsData?: BuildDetailsApiResponse | null;
  isBuildDetailsPending?: boolean;
}) {
  return (
    <BuildDetailsSidebarContent
      artifactId={artifactId}
      projectId={projectId}
      buildDetailsData={buildDetailsData}
      isBuildDetailsPending={isBuildDetailsPending}
    />
  );
}

describe('BuildDetailsSidebarContent', () => {
  const {organization} = initializeOrg({
    organization: OrganizationFixture(),
  });

  const defaultProps = {
    artifactId: '123',
    projectId: 'test-project',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders loading skeleton when data is pending', () => {
    render(<TestComponent {...defaultProps} isBuildDetailsPending />, {
      organization,
    });

    expect(screen.getAllByTestId('loading-placeholder').length).toBeGreaterThan(0);
  });

  it('renders app info, build metadata section when artifact state is PROCESSED', async () => {
    const buildDetailsData = {
      ...mockBuildDetailsData,
      state: BuildDetailsState.PROCESSED,
    };

    render(<TestComponent {...defaultProps} buildDetailsData={buildDetailsData} />, {
      organization,
    });

    // App info should be visible
    await waitFor(() => {
      expect(screen.getByText('Test App')).toBeInTheDocument();
    });

    // Build Metadata should show VCS data
    expect(screen.getByText('Build Metadata')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument(); // head_sha
    expect(screen.getByText('def456')).toBeInTheDocument(); // base_sha
    expect(screen.getByText('main')).toBeInTheDocument(); // head_ref
    expect(screen.getByText('master')).toBeInTheDocument(); // base_ref
    expect(screen.getByText('123')).toBeInTheDocument(); // pr_number
    expect(screen.getByText('test-repo')).toBeInTheDocument(); // repo_name
  });

  it('hides app info, status check info and build metadata section when artifact state is UPLOADED', () => {
    const buildDetailsData = {
      ...mockBuildDetailsData,
      state: BuildDetailsState.UPLOADED,
    };

    render(<TestComponent {...defaultProps} buildDetailsData={buildDetailsData} />, {
      organization,
    });

    // App info, status check info and build metadata section should be hidden
    expect(screen.queryByText('Test App')).not.toBeInTheDocument();
    expect(screen.queryByText('Status check info')).not.toBeInTheDocument();
    expect(screen.queryByText('Build Metadata')).not.toBeInTheDocument();
  });

  it('hides app info, status check info and build metadata section when artifact state is UPLOADING', () => {
    const buildDetailsData = {
      ...mockBuildDetailsData,
      state: BuildDetailsState.UPLOADING,
    };

    render(<TestComponent {...defaultProps} buildDetailsData={buildDetailsData} />, {
      organization,
    });

    // App info, status check info and build metadata section should be hidden
    expect(screen.queryByText('Test App')).not.toBeInTheDocument();
    expect(screen.queryByText('Status check info')).not.toBeInTheDocument();
    expect(screen.queryByText('Build Metadata')).not.toBeInTheDocument();
  });

  it('hides app info, status check info and build metadata section when artifact state is FAILED', () => {
    const buildDetailsData = {
      ...mockBuildDetailsData,
      state: BuildDetailsState.FAILED,
    };

    render(<TestComponent {...defaultProps} buildDetailsData={buildDetailsData} />, {
      organization,
    });

    // App info, status check info and build metadata section should be hidden
    expect(screen.queryByText('Test App')).not.toBeInTheDocument();
    expect(screen.queryByText('Status check info')).not.toBeInTheDocument();
    expect(screen.queryByText('Build Metadata')).not.toBeInTheDocument();
  });

  describe('Base Build row', () => {
    it('does not render Base Build row when base_sha is null', async () => {
      const buildDetailsData: BuildDetailsApiResponse = {
        ...mockBuildDetailsData,
        vcs_info: {
          ...mockBuildDetailsData.vcs_info,
          base_sha: null,
        },
      };

      render(<TestComponent {...defaultProps} buildDetailsData={buildDetailsData} />, {
        organization,
      });

      await waitFor(() => {
        expect(screen.getByText('Build Metadata')).toBeInTheDocument();
      });

      // Base Build row should not be present
      expect(screen.queryByText('Base Build')).not.toBeInTheDocument();
    });

    it('renders Base Build row with dash when base_sha exists but no base_build_info', async () => {
      const buildDetailsData = {
        ...mockBuildDetailsData,
        vcs_info: {
          ...mockBuildDetailsData.vcs_info,
          base_sha: 'def456',
        },
        base_build_info: null,
      };

      render(<TestComponent {...defaultProps} buildDetailsData={buildDetailsData} />, {
        organization,
      });

      await waitFor(() => {
        expect(screen.getByText('Build Metadata')).toBeInTheDocument();
      });

      // Base Build row should be present with label
      const baseBuildLabel = screen.getByText('Base Build');
      expect(baseBuildLabel).toBeInTheDocument();

      // Get the parent ContentWrapper and find the dash within it
      const contentWrapper = baseBuildLabel.parentElement!;
      expect(contentWrapper).toBeInTheDocument();

      // Verify the dash is in the same row (ContentWrapper) as "Base Build"
      expect(contentWrapper).toHaveTextContent('-');
    });

    it('renders Base Build row with link when base_sha and base_build_info exist', async () => {
      const buildDetailsData: BuildDetailsApiResponse = {
        ...mockBuildDetailsData,
        vcs_info: {
          ...mockBuildDetailsData.vcs_info,
          base_sha: 'def456',
        },
        base_artifact_id: 'base-artifact-id',
        base_build_info: {
          version: '1.0',
          build_number: '2',
        },
      };

      render(<TestComponent {...defaultProps} buildDetailsData={buildDetailsData} />, {
        organization,
      });

      await waitFor(() => {
        expect(screen.getByText('Build Metadata')).toBeInTheDocument();
      });

      // Base Build row should be present with label
      const baseBuildLabel = screen.getByText('Base Build');
      expect(baseBuildLabel).toBeInTheDocument();

      // Get the parent ContentWrapper and verify the build name is within it
      const contentWrapper = baseBuildLabel.parentElement!;
      expect(contentWrapper).toBeInTheDocument();
      expect(contentWrapper).toHaveTextContent('v1.0 (2)');

      // Should have a link to the base build page
      const baseBuildLink = screen.getByRole('link', {name: 'v1.0 (2)'});
      expect(baseBuildLink).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/preprod/${defaultProps.projectId}/base-artifact-id/`
      );

      // Should be an internal link (not opening in a new tab)
      expect(baseBuildLink).not.toHaveAttribute('target', '_blank');
    });

    it('renders Base Build row with dash when projectId is null', async () => {
      const buildDetailsData: BuildDetailsApiResponse = {
        ...mockBuildDetailsData,
        vcs_info: {
          ...mockBuildDetailsData.vcs_info,
          base_sha: 'def456',
        },
        base_artifact_id: 'base-artifact-id',
        base_build_info: {
          version: '1.0',
          build_number: '2',
        },
      };

      render(
        <TestComponent
          {...defaultProps}
          projectId={null as unknown as string}
          buildDetailsData={buildDetailsData}
        />,
        {
          organization,
        }
      );

      await waitFor(() => {
        expect(screen.getByText('Build Metadata')).toBeInTheDocument();
      });

      // Base Build row should be present with label
      const baseBuildLabel = screen.getByText('Base Build');
      expect(baseBuildLabel).toBeInTheDocument();

      // Get the parent ContentWrapper and verify the build name is within it
      const contentWrapper = baseBuildLabel.parentElement!;
      expect(contentWrapper).toBeInTheDocument();
      expect(contentWrapper).toHaveTextContent('-');

      // Should NOT have a link (no projectId to build URL)
      expect(screen.queryByRole('link', {name: 'v1.0 (2)'})).not.toBeInTheDocument();
    });
  });
});
