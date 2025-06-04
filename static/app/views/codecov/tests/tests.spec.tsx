import {render, screen} from 'sentry-test/reactTestingLibrary';

import TestsPage from 'sentry/views/codecov/tests/tests';

describe('CoveragePageWrapper', () => {
  describe('when the wrapper is used', () => {
    it('renders the passed children', async () => {
      render(<TestsPage />, {
        initialRouterConfig: {
          location: {
            pathname: '/codecov/tests',
            query: {codecovPeriod: '7d'},
          },
        },
      });

      const testsAnalytics = await screen.findByText('Test Analytics');
      expect(testsAnalytics).toBeInTheDocument();
    });
  });
});
