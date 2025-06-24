import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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

    it('renders the regenerate token button', async () => {
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

      const regenerateButton = await screen.findByRole('button', {
        name: 'regenerate token',
      });
      expect(regenerateButton).toBeInTheDocument();
      expect(regenerateButton).toHaveTextContent('Regenerate token');
    });

    it('handles regenerate token button click', async () => {
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

      const regenerateButton = await screen.findByRole('button', {
        name: 'regenerate token',
      });
      await userEvent.click(regenerateButton);
    });
  });
});
