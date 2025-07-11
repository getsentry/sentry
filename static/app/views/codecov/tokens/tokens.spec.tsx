import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import TokensPage from 'sentry/views/codecov/tokens/tokens';

describe('TokensPage', () => {
  describe('when the wrapper is used', () => {
    it('renders the header', async () => {
      render(
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
              query: {
                integratedOrg: 'some-org-name',
              },
            },
          },
        }
      );
      await screen.findByText('Repository tokens');
    });

    it('displays the integrated organization name in the description', async () => {
      render(
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
              query: {
                integratedOrg: 'test-org',
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
      render(
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
              query: {
                integratedOrg: 'some-org-name',
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
      render(
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
              query: {
                integratedOrg: 'some-org-name',
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

    it('renders a confirm modal when the regenerate token button is clicked', async () => {
      render(
        <CodecovQueryParamsProvider>
          <TokensPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tokens/',
              query: {
                integratedOrg: 'some-org-name',
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

      await userEvent.click(screen.getByRole('button', {name: 'Generate new token'}));

      // TODO: Add the action stuff when this is linked up
    });
  });
});
