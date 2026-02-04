import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import TestAnalyticsPageWrapper from 'sentry/views/prevent/tests/testsWrapper';

const COVERAGE_FEATURE = 'prevent-test-analytics';

describe('TestAnalyticsPageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the document title', () => {
      render(<TestAnalyticsPageWrapper />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const testTitle = screen.getByText('Test Analytics');
      expect(testTitle).toBeInTheDocument();
    });
  });
});
