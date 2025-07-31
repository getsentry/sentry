import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import TokensPage from 'sentry/views/codecov/tokens/tokens';

const mockIntegrations = [
  {name: 'some-org-name', id: '1'},
  {name: 'test-org', id: '2'},
];

const mockApiCall = () => {
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/integrations/`,
    method: 'GET',
    body: mockIntegrations,
  });
};

describe('TokensPage', () => {
  describe('when the wrapper is used', () => {
    it('renders the header', async () => {
      mockApiCall();
      render(
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
              query: {
                integratedOrgId: '1',
              },
            },
          },
        }
      );
      await screen.findByText('Repository tokens');
    });

    it('displays the integrated organization name in the description', async () => {
      mockApiCall();
      render(
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
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
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
              query: {
                integratedOrgId: '1',
              },
            },
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });

    it('renders repository tokens and related data', async () => {
      mockApiCall();
      render(
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
              query: {
                integratedOrgId: '1',
              },
            },
          },
        }
      );

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
      expect(screen.getByText('test2')).toBeInTheDocument();
      expect(screen.getByText('test2Token')).toBeInTheDocument();
      expect(screen.getByText('Mar 19, 2024 6:33:30 PM CET')).toBeInTheDocument();
      expect(await screen.findAllByText('Regenerate token')).toHaveLength(2);
    });

    it('Creates new token when regenerate token button is clicked after opening the modal and clicking the Generate new token button', async () => {
      mockApiCall();
      render(
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
              query: {
                integratedOrgId: '1',
              },
            },
          },
        }
      );
      renderGlobalModal();

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });

      const regenerateTokenButtons = await screen.findAllByText('Regenerate token');
      expect(regenerateTokenButtons).toHaveLength(2);
      await userEvent.click(regenerateTokenButtons[0]!);

      expect(await screen.findByRole('dialog')).toBeInTheDocument();

      // Click the Generate new token button to open the modal
      await userEvent.click(screen.getByRole('button', {name: 'Generate new token'}));

      // This is confirming all the new modal stuff
      expect(
        await screen.findByRole('heading', {name: 'Token created'})
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          `Please copy this token to a safe place - it won't be shown again.`
        )
      ).toBeInTheDocument();

      expect(screen.getByDisplayValue('SENTRY_PREVENT_TOKEN')).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('91b57316-b1ff-4884-8d55-92b9936a05a3')
      ).toBeInTheDocument();

      expect(screen.getByRole('button', {name: 'Done'})).toBeInTheDocument();
    });
  });
});
