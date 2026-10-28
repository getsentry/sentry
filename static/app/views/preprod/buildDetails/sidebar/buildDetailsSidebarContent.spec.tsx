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
    platform: 'apple',
    artifact_type: 0,
    build_configuration: 'Release',
    date_built: '2023-01-01T00:00:00Z',
    date_added: '2023-01-01T00:00:00Z',
  },
  distribution_info: {
    is_installable: true,
    download_count: 5,
    release_notes: 'Release notes',
    install_groups: null,
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
  buildDetailsData,
  isBuildDetailsPending,
}: {
  buildDetailsData?: BuildDetailsApiResponse | null;
  isBuildDetailsPending?: boolean;
}) {
  return (
    <BuildDetailsSidebarContent
      buildDetailsData={buildDetailsData}
      isBuildDetailsPending={isBuildDetailsPending}
    />
  );
}

describe('BuildDetailsSidebarContent', () => {
  const {organization} = initializeOrg({
    organization: OrganizationFixture(),
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders loading skeleton when data is pending', () => {
    render(<TestComponent isBuildDetailsPending />, {
      organization,
    });

    expect(screen.getAllByTestId('loading-placeholder').length).toBeGreaterThan(0);
  });

  it('renders build metadata section when artifact state is PROCESSED', async () => {
    const buildDetailsData = {
      ...mockBuildDetailsData,
      state: BuildDetailsState.PROCESSED,
    };

    render(<TestComponent buildDetailsData={buildDetailsData} />, {
      organization,
    });

    // Build Metadata should show VCS data
    await waitFor(() => {
      expect(screen.getByText('Build Metadata')).toBeInTheDocument();
    });
    expect(screen.getByText('abc123')).toBeInTheDocument(); // head_sha
    expect(screen.getByText('def456')).toBeInTheDocument(); // base_sha
    expect(screen.getByText('main')).toBeInTheDocument(); // head_ref
    expect(screen.getByText('master')).toBeInTheDocument(); // base_ref
    expect(screen.getByText('123')).toBeInTheDocument(); // pr_number
    expect(screen.getByText('test-repo')).toBeInTheDocument(); // repo_name
  });

  it.each([
    ['UPLOADED', BuildDetailsState.UPLOADED],
    ['UPLOADING', BuildDetailsState.UPLOADING],
    ['FAILED', BuildDetailsState.FAILED],
  ])(
    'hides status check info and build metadata section when artifact state is %s',
    (_name, state) => {
      const buildDetailsData = {...mockBuildDetailsData, state};

      render(<TestComponent buildDetailsData={buildDetailsData} />, {
        organization,
      });

      expect(screen.queryByText('Status check info')).not.toBeInTheDocument();
      expect(screen.queryByText('Build Metadata')).not.toBeInTheDocument();
    }
  );

  describe('Base Build row', () => {
    it('does not render Base Build row when base_sha is null', async () => {
      const buildDetailsData: BuildDetailsApiResponse = {
        ...mockBuildDetailsData,
        vcs_info: {
          ...mockBuildDetailsData.vcs_info,
          base_sha: null,
        },
      };

      render(<TestComponent buildDetailsData={buildDetailsData} />, {
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

      render(<TestComponent buildDetailsData={buildDetailsData} />, {
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

      render(<TestComponent buildDetailsData={buildDetailsData} />, {
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
        `/organizations/${organization.slug}/preprod/size/base-artifact-id/`
      );

      // Should be an internal link (not opening in a new tab)
      expect(baseBuildLink).not.toHaveAttribute('target', '_blank');
    });
  });
});
