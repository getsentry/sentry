import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TESTS_PAGE_TITLE} from 'sentry/views/codecov/settings';
import TestAnalyticsPageWrapper from 'sentry/views/codecov/tests/testsWrapper';

const COVERAGE_FEATURE = 'codecov-ui';

describe('TestAnalyticsPageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the document title', () => {
      render(<TestAnalyticsPageWrapper />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const testTitle = screen.getByText(TESTS_PAGE_TITLE);
      expect(testTitle).toBeInTheDocument();
    });
  });
});
