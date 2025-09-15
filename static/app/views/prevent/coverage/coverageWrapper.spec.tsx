import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CoveragePageWrapper from 'sentry/views/prevent/coverage/coverageWrapper';
import {COVERAGE_PAGE_TITLE} from 'sentry/views/prevent/settings';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CoveragePageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the document title', () => {
      render(<CoveragePageWrapper />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const testTitle = screen.getByText(COVERAGE_PAGE_TITLE);
      expect(testTitle).toBeInTheDocument();
    });
  });
});
