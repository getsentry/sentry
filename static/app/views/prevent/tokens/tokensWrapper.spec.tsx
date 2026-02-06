import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TokensPageWrapper from 'sentry/views/prevent/tokens/tokensWrapper';

const COVERAGE_FEATURE = 'prevent-test-analytics';

describe('TokensPageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the document title', () => {
      render(<TokensPageWrapper />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const tokensTitle = screen.getByText('Tokens');
      expect(tokensTitle).toBeInTheDocument();
    });

    it('renders the question tooltip with correct content', async () => {
      render(<TokensPageWrapper />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const tooltip = screen.getByTestId('more-information');
      expect(tooltip).toBeInTheDocument();

      await userEvent.hover(tooltip);
      expect(
        await screen.findByText(
          'Manage your upload tokens that are created in Sentry Prevent.'
        )
      ).toBeInTheDocument();
    });
  });
});
