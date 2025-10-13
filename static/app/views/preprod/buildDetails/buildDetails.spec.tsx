import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import BuildDetails from './buildDetails';

describe('BuildDetails', () => {
  const {organization} = initializeOrg({
    organization: OrganizationFixture(),
    router: {
      params: {
        projectSlug: 'project-1',
        artifactId: 'artifact-1',
      },
    },
  });

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/projects/project-1/preprod/artifacts/artifact-1/`,
    },
    route: '/organizations/:orgId/projects/:projectSlug/preprod/artifacts/:artifactId/',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows loading skeletons when queries are pending', () => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-1/preprodartifacts/artifact-1/build-details/`,
      method: 'GET',
      body: new Promise(() => {}),
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-1/files/preprodartifacts/artifact-1/size-analysis/`,
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
      url: `/projects/org-slug/project-1/preprodartifacts/artifact-1/build-details/`,
      method: 'GET',
      statusCode: 500,
      body: {detail: 'Failed to load build details'},
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-1/files/preprodartifacts/artifact-1/size-analysis/`,
      method: 'GET',
      body: {
        treemap: {
          root: {name: 'root', size: 1024000, children: []},
          category_breakdown: {},
        },
        insights: [],
      },
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
      url: `/projects/org-slug/project-1/preprodartifacts/artifact-1/build-details/`,
      method: 'GET',
      body: {
        id: 'artifact-1',
        state: 3, // PROCESSED
        app_info: {
          version: '1.0.0',
          build_number: '123',
          name: 'Test App',
        },
        vcs_info: {
          head_sha: 'abc123',
          base_sha: 'def456',
          pr_number: 42,
          head_ref: 'feature-branch',
          base_ref: 'main',
          head_repo_name: 'test/repo',
          base_repo_name: 'test/repo',
        },
        size_info: {
          state: 2, // COMPLETED
          install_size_bytes: 1024000,
          download_size_bytes: 512000,
        },
      },
    });

    const appSizeMock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-1/files/preprodartifacts/artifact-1/size-analysis/`,
      method: 'GET',
      body: {
        treemap: {
          root: {name: 'root', size: 1024000, children: []},
          category_breakdown: {},
        },
        insights: [],
      },
    });

    render(<BuildDetails />, {
      organization,
      initialRouterConfig,
    });

    await waitFor(() => expect(buildDetailsMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(appSizeMock).toHaveBeenCalledTimes(1));

    expect(await screen.findByText('v1.0.0 (123)')).toBeInTheDocument();
    expect(await screen.findByText('Git details')).toBeInTheDocument();
  });

  it('shows "Your app is still being analyzed..." text when size analysis is processing', async () => {
    MockApiClient.clearMockResponses();

    const buildDetailsMock = MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-1/preprodartifacts/artifact-1/build-details/`,
      method: 'GET',
      body: {
        id: 'artifact-1',
        state: 3, // PROCESSED
        app_info: {
          version: '1.0.0',
          build_number: '123',
          name: 'Test App',
        },
        vcs_info: {
          head_sha: 'abc123',
        },
        size_info: {
          state: 1, // PROCESSING
        },
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-1/files/preprodartifacts/artifact-1/size-analysis/`,
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
});
