import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import PreventQueryParamsProvider from 'sentry/components/prevent/container/preventParamsProvider';
import TokensPage from 'sentry/views/prevent/tokens/tokens';

jest.mock('sentry/components/pagination', () => {
  return function MockPagination() {
    return <div>Pagination Component</div>;
  };
});

const mockIntegrations = [
  {name: 'some-org-name', id: '1'},
  {name: 'test-org', id: '2'},
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
};

describe('TokensPage', () => {
  describe('when the wrapper is used', () => {
    it('renders the header', async () => {
      mockApiCall();
      render(
        <PreventQueryParamsProvider>
          <TokensPage />
        </PreventQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tokens/',
              query: {
                integratedOrgId: '1',
              },
            },
          },
        }
      );
      expect(await screen.findByText('Repository tokens')).toBeInTheDocument();
    });

    it('displays the integrated organization name in the description', async () => {
      mockApiCall();
      render(
        <PreventQueryParamsProvider>
          <TokensPage />
        </PreventQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tokens/',
              query: {
                integratedOrgId: '2',
              },
            },
          },
        }
      );

      expect(
        await screen.findByText(
          /View the list of tokens created for your repositories in/
        )
      ).toBeInTheDocument();

      const descriptionElement = screen.getByText(
        /View the list of tokens created for your repositories in/
      );
      expect(descriptionElement).toHaveTextContent('test-org');
      expect(
        screen.getByText(
          /Use them for uploading reports to all Sentry Prevent's features./
        )
      ).toBeInTheDocument();
    });

    it('renders a table component', async () => {
      mockApiCall();
      render(
        <PreventQueryParamsProvider>
          <TokensPage />
        </PreventQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tokens/',
              query: {
                integratedOrgId: '1',
              },
            },
          },
        }
      );

      expect(await screen.findByRole('table')).toBeInTheDocument();
    });

    it('renders the pagination component', async () => {
      mockApiCall();
      render(
        <PreventQueryParamsProvider>
          <TokensPage />
        </PreventQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tokens/',
              query: {
                integratedOrgId: '1',
              },
            },
          },
        }
      );

      expect(await screen.findByText('Pagination Component')).toBeInTheDocument();
    });

    it('renders repository tokens and related data', async () => {
      mockApiCall();
      render(
        <PreventQueryParamsProvider>
          <TokensPage />
        </PreventQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tokens/',
              query: {
                integratedOrgId: '1',
              },
            },
          },
        }
      );

      expect(await screen.findByRole('table')).toBeInTheDocument();
      expect(screen.getByText('test2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test2Token')).toBeInTheDocument();
      expect(await screen.findAllByText('Regenerate token')).toHaveLength(2);
    });

    it('Creates new token when regenerate token button is clicked after opening the modal and clicking the Generate new token button', async () => {
      mockApiCall();

      // Mock the regenerate token API call
      const regenerateTokenMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prevent/owner/1/repository/test2/token/regenerate/',
        method: 'POST',
        body: {
          token: 'new-generated-token-12345',
        },
      });

      render(
        <PreventQueryParamsProvider>
          <TokensPage />
        </PreventQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/prevent/tokens/',
              query: {
                integratedOrgId: '1',
              },
            },
          },
        }
      );
      renderGlobalModal();

      expect(await screen.findByRole('table')).toBeInTheDocument();

      const regenerateTokenButtons = await screen.findAllByText('Regenerate token');
      expect(regenerateTokenButtons).toHaveLength(2);
      await userEvent.click(regenerateTokenButtons[0]!);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      // Click the Generate new token button to open the modal
      await userEvent.click(screen.getByRole('button', {name: 'Generate new token'}));

      // Wait for the API call to complete
      await waitFor(() => expect(regenerateTokenMock).toHaveBeenCalled());

      // This is confirming all the new modal stuff
      expect(
        await screen.findByRole('heading', {name: 'Token created'})
      ).toBeInTheDocument();

      expect(screen.getByDisplayValue('new-generated-token-12345')).toBeInTheDocument();
    });

    describe('Sorting integration', () => {
      it('renders with correct sort state when sort parameter is in URL', async () => {
        mockApiCall();
        render(
          <PreventQueryParamsProvider>
            <TokensPage />
          </PreventQueryParamsProvider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/prevent/tokens/',
                query: {
                  integratedOrgId: '1',
                  sort: 'name', // ascending sort
                },
              },
            },
          }
        );

        expect(await screen.findByRole('table')).toBeInTheDocument();

        expect(
          screen.getAllByRole('columnheader', {name: /repository name/i})[1]
        ).toHaveAttribute('aria-sort', 'ascending');
      });

      it('renders with descending sort state when negative sort parameter is in URL', async () => {
        mockApiCall();
        render(
          <PreventQueryParamsProvider>
            <TokensPage />
          </PreventQueryParamsProvider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/prevent/tokens/',
                query: {
                  integratedOrgId: '1',
                  sort: '-name', // descending sort
                },
              },
            },
          }
        );

        expect(await screen.findByRole('table')).toBeInTheDocument();

        expect(
          screen.getAllByRole('columnheader', {name: /repository name/i})[1]
        ).toHaveAttribute('aria-sort', 'descending');
      });

      it('renders with no sort state when no sort parameter is in URL', async () => {
        mockApiCall();
        render(
          <PreventQueryParamsProvider>
            <TokensPage />
          </PreventQueryParamsProvider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/prevent/tokens/',
                query: {
                  integratedOrgId: '1',
                  // no sort parameter
                },
              },
            },
          }
        );

        expect(await screen.findByRole('table')).toBeInTheDocument();

        expect(
          screen.getAllByRole('columnheader', {name: /repository name/i})[1]
        ).toHaveAttribute('aria-sort', 'none');
      });

      it('passes sortBy parameter to API when valid sort is provided', async () => {
        MockApiClient.addMockResponse({
          url: `/organizations/org-slug/integrations/`,
          method: 'GET',
          body: mockIntegrations,
        });

        const mockTokensCall = MockApiClient.addMockResponse({
          url: `/organizations/org-slug/prevent/owner/1/repositories/tokens/`,
          method: 'GET',
          body: mockRepositoryTokensResponse,
        });

        render(
          <PreventQueryParamsProvider>
            <TokensPage />
          </PreventQueryParamsProvider>,
          {
            initialRouterConfig: {
              location: {
                pathname: '/prevent/tokens/',
                query: {
                  integratedOrgId: '1',
                  sort: '-name', // descending name sort
                },
              },
            },
          }
        );

        await screen.findByRole('table');

        // API should be called with sortBy parameter
        await waitFor(() => {
          expect(mockTokensCall).toHaveBeenCalledWith(
            '/organizations/org-slug/prevent/owner/1/repositories/tokens/',
            expect.objectContaining({
              query: expect.objectContaining({
                sortBy: '-NAME',
              }),
            })
          );
        });
      });
    });
  });
});
