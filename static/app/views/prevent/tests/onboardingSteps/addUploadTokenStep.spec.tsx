import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
  });

  it('renders the step header with correct step number', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });

    renderComponent({step: '2'});

    await screen.findByText('Step 2: Add token as');
    expect(screen.getByText('Step 2: Add token as')).toBeInTheDocument();
  });

  it('constructs the GitHub URL correctly using GitHub organization name and repository', async () => {
    const customOrg = OrganizationFixture({slug: 'custom-org'});
    const customContext = {
      ...mockPreventContext,
      repository: 'custom-repo',
      integratedOrgId: '456',
    };
    const customIntegration = {
      ...mockGitHubIntegration,
      id: '456',
      name: 'github-org-name',
      domainName: 'github.com/github-org-name',
    };

    MockApiClient.addMockResponse({
      url: '/organizations/custom-org/integrations/',
      body: [customIntegration],
    });

    render(
      <PreventContext.Provider value={customContext}>
        <AddUploadTokenStep step="1" />
      </PreventContext.Provider>,
      {
        organization: customOrg,
      }
    );

    const link = await screen.findByRole('link', {name: 'repository secret'});
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/github-org-name/custom-repo/settings/secrets/actions'
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
    // this href is after "#" was normalized by the Link component
    expect(link).toHaveAttribute('href', '/mock-pathname/');
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

    renderComponent();

    await screen.findByRole('button', {name: 'Generate Repository Token'});
    expect(
      screen.getByRole('button', {name: 'Generate Repository Token'})
    ).toBeInTheDocument();
  });

  it('shows token details after clicking generate button', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });

    renderComponent();

    const generateButton = screen.getByRole('button', {
      name: 'Generate Repository Token',
    });
    await userEvent.click(generateButton);

    expect(screen.getByText('SENTRY_PREVENT_TOKEN')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Regenerate'})).toBeInTheDocument();
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
