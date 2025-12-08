import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import localStorageWrapper from 'sentry/utils/localStorage';
import {parseSortFromQuery} from 'sentry/views/prevent/tokens/repoTokenTable/repoTokenTable';
import TokensPage from 'sentry/views/prevent/tokens/tokens';

const mockIntegrations = [
  {name: 'some-org-name', id: '1', status: 'active'},
  {name: 'test-org', id: '2', status: 'active'},
];

const mockRepositoryTokensResponse = {
  pageInfo: {
    endCursor: 'cursor123',
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: 'cursor000',
  },
  results: [
    {
      name: 'test2',
      token: 'test2Token',
    },
    {
      name: 'test-repo',
      token: 'test-repo-token',
    },
  ],
  totalCount: 2,
};

const mockApiCall = () => {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/integrations/`,
    method: 'GET',
    body: mockIntegrations,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/prevent/owner/1/repositories/tokens/`,
    method: 'GET',
    body: mockRepositoryTokensResponse,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/prevent/owner/2/repositories/tokens/`,
    method: 'GET',
    body: mockRepositoryTokensResponse,
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/config/integrations/`,
    method: 'GET',
    body: {
      providers: [GitHubIntegrationProviderFixture()],
    },
  });
};

describe('TokensPage', () => {
  beforeEach(() => {
    localStorageWrapper.clear();

    localStorageWrapper.setItem(
      'prevent-selection:org-slug',
      JSON.stringify({
        'test-integration': {
          integratedOrgId: '1',
        },
        'test-integration-2': {
          integratedOrgId: '2',
        },
      })
    );
  });

  const renderTokensPage = (options = {}) => {
    const defaultOptions = {
      integratedOrgName: 'test-integration',
      ...options,
    };

    return render(
      <PreventQueryParamsProvider>
        <TokensPage />
      </PreventQueryParamsProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/prevent/tokens/',
            query: defaultOptions,
          },
        },
      }
    );
  };

  it('renders the header', async () => {
    mockApiCall();
    renderTokensPage();
    expect(await screen.findByText('Repository tokens')).toBeInTheDocument();
  });

  it('displays the integrated organization name in the description', async () => {
    mockApiCall();
    renderTokensPage({integratedOrgName: 'test-integration-2'});

    expect(
      await screen.findByText(/View the list of tokens created for your repositories in/)
    ).toBeInTheDocument();

    const descriptionElement = screen.getByText(
      /View the list of tokens created for your repositories in/
    );
    expect(descriptionElement).toHaveTextContent('test-org');
    expect(
      screen.getByText(/Use them for uploading reports to all Sentry Prevent's features./)
    ).toBeInTheDocument();
  });

  it('renders a table component', async () => {
    mockApiCall();
    renderTokensPage();

    expect(
      await screen.findByRole('columnheader', {name: 'Repository name'})
    ).toBeInTheDocument();
  });

  it('renders the navigation controls', async () => {
    mockApiCall();
    renderTokensPage();

    expect(await screen.findByRole('button', {name: 'Previous'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Next'})).toBeInTheDocument();
  });

  it('renders repository tokens and related data', async () => {
    mockApiCall();
    renderTokensPage();

    expect(
      await screen.findByRole('columnheader', {name: 'Repository name'})
    ).toBeInTheDocument();
    expect(screen.getByText('test2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('test2Token')).toBeInTheDocument();
    expect(await screen.findAllByText('Regenerate token')).toHaveLength(2);
  });

  describe('Sorting integration', () => {
    it('renders with correct sort state when sort parameter is in URL', async () => {
      mockApiCall();
      renderTokensPage({sort: 'name'});

      expect(
        await screen.findByRole('columnheader', {name: 'Repository name'})
      ).toBeInTheDocument();

      const nameHeader = screen.getByRole('columnheader', {name: 'Repository name'});
      expect(nameHeader?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with descending sort state when negative sort parameter is in URL', async () => {
      mockApiCall();
      renderTokensPage({sort: '-name'});

      expect(
        await screen.findByRole('columnheader', {name: 'Repository name'})
      ).toBeInTheDocument();

      const nameHeader = screen.getByRole('columnheader', {name: 'Repository name'});
      expect(nameHeader?.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with no sort state when no sort parameter is in URL', async () => {
      mockApiCall();
      renderTokensPage();

      expect(
        await screen.findByRole('columnheader', {name: 'Repository name'})
      ).toBeInTheDocument();

      const nameHeader = screen.getByRole('columnheader', {name: 'Repository name'});
      expect(nameHeader?.querySelector('svg')).not.toBeInTheDocument();
    });

    it('handles three-state sorting behavior correctly', () => {
      expect(parseSortFromQuery()).toBeUndefined();
      expect(parseSortFromQuery('name')).toEqual({field: 'name', direction: 'asc'});
      expect(parseSortFromQuery('-name')).toEqual({field: 'name', direction: 'desc'});
    });

    it('passes sortBy parameter to API when valid sort is provided', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/integrations/`,
        method: 'GET',
        body: mockIntegrations,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/org-slug/config/integrations/`,
        method: 'GET',
        body: {
          providers: [GitHubIntegrationProviderFixture()],
        },
      });

      const mockTokensCall = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/prevent/owner/1/repositories/tokens/`,
        method: 'GET',
        body: mockRepositoryTokensResponse,
      });

      renderTokensPage({sort: '-name'});

      await screen.findByRole('table');

      // API should be called with sortBy parameter
      await waitFor(() => {
        expect(mockTokensCall).toHaveBeenCalledWith(
          '/organizations/org-slug/prevent/owner/1/repositories/tokens/',
          expect.objectContaining({query: expect.objectContaining({sortBy: '-NAME'})})
        );
      });
    });
  });
});
