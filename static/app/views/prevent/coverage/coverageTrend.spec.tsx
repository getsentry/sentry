import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import CoverageTrendPage from 'sentry/views/prevent/coverage/coverageTrend';

const COVERAGE_FEATURE = 'codecov-ui';

describe('CoverageTrendPage', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', () => {
      render(<CoverageTrendPage />, {
        organization: OrganizationFixture({features: [COVERAGE_FEATURE]}),
      });

      const coverageTrend = screen.getByText('Coverage Trend');
      expect(coverageTrend).toBeInTheDocument();
    });
  });
});
