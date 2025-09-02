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

  it('renders the step header with correct step number', () => {
    renderComponent({step: '2'});

    expect(screen.getByText('Step 2: Add token as')).toBeInTheDocument();
  });

  it('constructs the GitHub URL correctly using GitHub organization name and repository', () => {
    const customOrg = OrganizationFixture({slug: 'custom-org'});
    const customContext = {
      ...mockPreventContext,
      repository: 'custom-repo',
      integratedOrgId: '456',
    };
    const customIntegration = {
      ...mockGitHubIntegration,
      id: '456',
      name: 'custom-github-org',
    };

    // Mock the GitHub integrations API call
    const MockApiClient = require('sentry-test/apiClient');
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

    const link = screen.getByRole('link', {name: 'repository secret'});
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/custom-github-org/custom-repo/settings/secrets/actions'
    );
  });

  it('handles missing integration data gracefully', () => {
    const contextWithoutIntegration = {
      ...mockPreventContext,
      integratedOrgId: undefined,
    };

    // Mock empty integrations response
    const MockApiClient = require('sentry-test/apiClient');
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

    const link = screen.getByRole('link', {name: 'repository secret'});
    expect(link).toHaveAttribute('href', '#');
  });

  it('handles special characters in organization and repository names', () => {
    const contextWithSpecialChars = {
      ...mockPreventContext,
      repository: 'test-repo@v2',
      integratedOrgId: '789',
    };
    const integrationWithSpecialChars = {
      ...mockGitHubIntegration,
      id: '789',
      name: 'test-org@v1',
    };

    // Mock the GitHub integrations API call
    const MockApiClient = require('sentry-test/apiClient');
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [integrationWithSpecialChars],
    });

    render(
      <PreventContext.Provider value={contextWithSpecialChars}>
        <AddUploadTokenStep step="1" />
      </PreventContext.Provider>,
      {
        organization: mockOrganization,
      }
    );

    const link = screen.getByRole('link', {name: 'repository secret'});
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/test-org%40v1/test-repo%40v2/settings/secrets/actions'
    );
  });

  it('shows generate token button initially', () => {
    // Mock the GitHub integrations API call
    const MockApiClient = require('sentry-test/apiClient');
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });

    renderComponent();

    expect(
      screen.getByRole('button', {name: 'Generate Repository Token'})
    ).toBeInTheDocument();
  });

  it('shows token details after clicking generate button', async () => {
    // Mock the GitHub integrations API call
    const MockApiClient = require('sentry-test/apiClient');
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });

    renderComponent();

    const generateButton = screen.getByRole('button', {
      name: 'Generate Repository Token',
    });
    await userEvent.click(generateButton);

    expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
  });

  it('renders repository admin text correctly', () => {
    // Mock the GitHub integrations API call
    const MockApiClient = require('sentry-test/apiClient');
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });

    renderComponent();

    expect(screen.getByText('Repository admin')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sentry requires a token to authenticate uploading your coverage reports/
      )
    ).toBeInTheDocument();
  });

  it('renders expandable dropdown with correct trigger text', () => {
    // Mock the GitHub integrations API call
    const MockApiClient = require('sentry-test/apiClient');
    MockApiClient.addMockResponse({
      url: '/organizations/test-org/integrations/',
      body: [mockGitHubIntegration],
    });

    renderComponent();

    expect(
      screen.getByText('Your repository secret in GitHub should look like this:')
    ).toBeInTheDocument();
  });
});
