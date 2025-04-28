import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
  });
});
