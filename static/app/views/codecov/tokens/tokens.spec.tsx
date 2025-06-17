import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TokensPage from 'sentry/views/codecov/tokens/tokens';

const COVERAGE_FEATURE = 'codecov-ui';

describe('TokensPage', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', () => {
      render(<TokensPage />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const tokensPage = screen.getByText('Tokens');
      expect(tokensPage).toBeInTheDocument();
    });
  });
});
