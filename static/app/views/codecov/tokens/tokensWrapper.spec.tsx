import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {TOKENS_PAGE_TITLE} from 'sentry/views/codecov/settings';
import TokensPageWrapper from 'sentry/views/codecov/tokens/tokensWrapper';

const COVERAGE_FEATURE = 'codecov-ui';

describe('TokensPageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the document title', () => {
      render(<TokensPageWrapper />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const tokensTitle = screen.getByText(TOKENS_PAGE_TITLE);
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
