import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TestsPage from 'sentry/views/codecov/tests/tests';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CoveragePageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', () => {
      render(<TestsPage />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const testsAnalytics = screen.getByText('Test Analytics');
      expect(testsAnalytics).toBeInTheDocument();
    });
  });
});
