import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useApiQuery} from 'sentry/utils/queryClient';
import {BuildDetailsSidebarContent} from 'sentry/views/preprod/buildDetails/sidebar/buildDetailsSidebarContent';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {BuildDetailsState} from 'sentry/views/preprod/types/buildDetailsTypes';

const mockBuildDetailsData: BuildDetailsApiResponse = {
  id: '123',
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

function TestComponent({artifactId, projectId}: {artifactId: string; projectId: string}) {
  const buildDetailsQuery = useApiQuery<BuildDetailsApiResponse>(
    [`/projects/${projectId}/preprodartifacts/${artifactId}/build-details/`],
    {
      staleTime: 0,
    }
  );

  return (
    <BuildDetailsSidebarContent
      artifactId={artifactId}
      projectId={projectId}
      buildDetailsQuery={buildDetailsQuery}
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
    MockApiClient.addMockResponse({
      url: `/projects/${defaultProps.projectId}/preprodartifacts/${defaultProps.artifactId}/build-details/`,
      method: 'GET',
      body: new Promise(() => {}), // Never resolves
    });

    render(<TestComponent {...defaultProps} />, {
      organization,
    });

    expect(screen.getAllByTestId('loading-placeholder').length).toBeGreaterThan(0);
  });

  it('renders app info section when artifact state is PROCESSED', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${defaultProps.projectId}/preprodartifacts/${defaultProps.artifactId}/build-details/`,
      method: 'GET',
      body: {
        ...mockBuildDetailsData,
        state: BuildDetailsState.PROCESSED,
      },
    });

    render(<TestComponent {...defaultProps} />, {
      organization,
    });

    // App info should be visible
    await waitFor(() => {
      expect(screen.getByText('Test App')).toBeInTheDocument();
    });

    // Git details should show VCS data
    expect(screen.getByText('Git details')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument(); // head_sha
    expect(screen.getByText('def456')).toBeInTheDocument(); // base_sha
    expect(screen.getByText('main')).toBeInTheDocument(); // head_ref
    expect(screen.getByText('master')).toBeInTheDocument(); // base_ref
    expect(screen.getByText('123')).toBeInTheDocument(); // pr_number
    expect(screen.getByText('test-repo')).toBeInTheDocument(); // repo_name
  });

  it('hides app info section when artifact state is UPLOADED', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${defaultProps.projectId}/preprodartifacts/${defaultProps.artifactId}/build-details/`,
      method: 'GET',
      body: {
        ...mockBuildDetailsData,
        state: BuildDetailsState.UPLOADED,
      },
    });

    render(<TestComponent {...defaultProps} />, {
      organization,
    });

    // Git details should still show VCS data
    await waitFor(() => {
      expect(screen.getByText('Git details')).toBeInTheDocument();
    });
    expect(screen.getByText('abc123')).toBeInTheDocument(); // head_sha
    expect(screen.getByText('def456')).toBeInTheDocument(); // base_sha
    expect(screen.getByText('main')).toBeInTheDocument(); // head_ref
    expect(screen.getByText('master')).toBeInTheDocument(); // base_ref
    expect(screen.getByText('123')).toBeInTheDocument(); // pr_number
    expect(screen.getByText('test-repo')).toBeInTheDocument(); // repo_name

    // App info should be hidden
    expect(screen.queryByText('Test App')).not.toBeInTheDocument();
  });

  it('hides app info section when artifact state is UPLOADING', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${defaultProps.projectId}/preprodartifacts/${defaultProps.artifactId}/build-details/`,
      method: 'GET',
      body: {
        ...mockBuildDetailsData,
        state: BuildDetailsState.UPLOADING,
      },
    });

    render(<TestComponent {...defaultProps} />, {
      organization,
    });

    // Git details should still show VCS data
    await waitFor(() => {
      expect(screen.getByText('Git details')).toBeInTheDocument();
    });
    expect(screen.getByText('abc123')).toBeInTheDocument(); // head_sha
    expect(screen.getByText('def456')).toBeInTheDocument(); // base_sha
    expect(screen.getByText('main')).toBeInTheDocument(); // head_ref
    expect(screen.getByText('master')).toBeInTheDocument(); // base_ref
    expect(screen.getByText('123')).toBeInTheDocument(); // pr_number
    expect(screen.getByText('test-repo')).toBeInTheDocument(); // repo_name

    // App info should be hidden
    expect(screen.queryByText('Test App')).not.toBeInTheDocument();
  });

  it('hides app info section when artifact state is FAILED', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/${defaultProps.projectId}/preprodartifacts/${defaultProps.artifactId}/build-details/`,
      method: 'GET',
      body: {
        ...mockBuildDetailsData,
        state: BuildDetailsState.FAILED,
      },
    });

    render(<TestComponent {...defaultProps} />, {
      organization,
    });

    // Git details should still show VCS data
    await waitFor(() => {
      expect(screen.getByText('Git details')).toBeInTheDocument();
    });
    expect(screen.getByText('abc123')).toBeInTheDocument(); // head_sha
    expect(screen.getByText('def456')).toBeInTheDocument(); // base_sha
    expect(screen.getByText('main')).toBeInTheDocument(); // head_ref
    expect(screen.getByText('master')).toBeInTheDocument(); // base_ref
    expect(screen.getByText('123')).toBeInTheDocument(); // pr_number
    expect(screen.getByText('test-repo')).toBeInTheDocument(); // repo_name

    // App info should be hidden
    expect(screen.queryByText('Test App')).not.toBeInTheDocument();
  });
});
