import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PreventContext} from 'sentry/components/prevent/context/preventContext';
import {AddUploadTokenStep} from 'sentry/views/prevent/tests/onboardingSteps/addUploadTokenStep';

jest.mock(
  'sentry-images/features/test-analytics-repo-secret-dark.png',
  () => 'dark-image'
);
jest.mock(
  'sentry-images/features/test-analytics-repo-secret-light.png',
  () => 'light-image'
);

describe('AddUploadTokenStep', () => {
  const mockOrganization = OrganizationFixture({
    slug: 'test-org',
  });

  const mockPreventContext = {
    repository: 'test-repo',
    changeContextValue: jest.fn(),
    preventPeriod: '7d',
    branch: 'main',
    integratedOrgId: '123',
    lastVisitedOrgId: '123',
  };

  const mockGitHubIntegration = {
    id: '123',
    name: 'github-org-name',
    domainName: 'github.com/github-org-name',
    provider: {
      key: 'github',
      name: 'GitHub',
    },
    status: 'active',
  };

  const mockRepoDataWithToken = {
    testAnalyticsEnabled: false,
    uploadToken: 'test-token',
  };

  const mockRepoDataWithoutToken = {
    testAnalyticsEnabled: false,
    uploadToken: null,
  };

  const renderComponent = (props = {}) => {
    return render(
      <PreventContext.Provider value={mockPreventContext}>
        <AddUploadTokenStep step="1" {...props} />
      </PreventContext.Provider>,
      {
        organization: mockOrganization,
      }
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/prevent/owner/123/repository/test-repo/',
      body: mockRepoDataWithToken,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/prevent/owner/123/repository/test-repo/token/regenerate/',
      body: {token: 'test-token'},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });
  });

  it('renders the step header with correct step number', async () => {
    renderComponent({step: '2'});

    await screen.findByText('Step 2: Add token as');
    expect(screen.getByText('Step 2: Add token as')).toBeInTheDocument();
  });

  it('constructs the GitHub URL correctly using GitHub organization name and repository', async () => {
    render(
      <PreventContext.Provider value={mockPreventContext}>
        <AddUploadTokenStep step="1" />
      </PreventContext.Provider>,
      {
        organization: mockOrganization,
      }
    );

    const link = await screen.findByRole('link', {name: 'repository secret'});
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/github-org-name/test-repo/settings/secrets/actions'
    );
  });

  it('handles missing integration data gracefully', async () => {
    const contextWithoutIntegration = {
      ...mockPreventContext,
      integratedOrgId: undefined,
    };

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [],
    });

    render(
      <PreventContext.Provider value={contextWithoutIntegration}>
        <AddUploadTokenStep step="1" />
      </PreventContext.Provider>,
      {
        organization: mockOrganization,
      }
    );

    const link = await screen.findByRole('link', {name: 'repository secret'});
    expect(link).toHaveAttribute('href', '#');
  });

  it('handles valid GitHub naming characters in organization and repository names', async () => {
    const contextWithValidChars = {
      ...mockPreventContext,
      repository: 'test-repo_v2',
      integratedOrgId: '789',
    };
    const integrationWithValidChars = {
      ...mockGitHubIntegration,
      id: '789',
      name: 'test-org-v1',
      domainName: 'github.com/test-org-v1',
    };

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [integrationWithValidChars],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/prevent/owner/789/repository/test-repo_v2/',
      body: mockRepoDataWithToken,
    });

    render(
      <PreventContext.Provider value={contextWithValidChars}>
        <AddUploadTokenStep step="1" />
      </PreventContext.Provider>,
      {
        organization: mockOrganization,
      }
    );

    const link = await screen.findByRole('link', {name: 'repository secret'});
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/test-org-v1/test-repo_v2/settings/secrets/actions'
    );
  });

  it('shows generate token button initially', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/test-org/prevent/owner/123/repository/test-repo/',
      body: mockRepoDataWithoutToken,
    });

    renderComponent();

    await screen.findByRole('button', {name: 'Generate Repository Token'});
    expect(
      screen.getByRole('button', {name: 'Generate Repository Token'})
    ).toBeInTheDocument();
  });

  it('renders repository admin text correctly', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });

    renderComponent();

    await screen.findByText('Repository admin');
    expect(screen.getByText('Repository admin')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sentry requires a token to authenticate uploading your coverage reports/
      )
    ).toBeInTheDocument();
  });

  it('renders expandable dropdown with correct trigger text', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });

    renderComponent();

    await screen.findByText('Your repository secret in GitHub should look like this:');
    expect(
      screen.getByText('Your repository secret in GitHub should look like this:')
    ).toBeInTheDocument();
  });
});
