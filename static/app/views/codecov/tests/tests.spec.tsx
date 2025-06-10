import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import TestsPage from 'sentry/views/codecov/tests/tests';

const mockTestResultsData = [
  {
    name: 'tests.symbolicator.test_unreal_full.SymbolicatorUnrealIntegrationTest::test_unreal_crash_with_attachments',
    avgDuration: 4,
    flakeRate: 0.4,
    commitsFailed: 1,
    lastRun: '2025-04-17T22:26:19.486793+00:00',
    totalFailCount: 1,
    totalFlakyFailCount: 2,
    totalPassCount: 0,
    totalSkipCount: 3,
    updatedAt: '2025-04-17T22:26:19.486793+00:00',
  },
];

const mockApiCall = () =>
  MockApiClient.addMockResponse({
    url: `/prevent/owner/some-org-name/repository/some-repository/test-results/`,
    method: 'GET',
    body: {
      results: mockTestResultsData,
      pageInfo: {
        endCursor: 'sdfgadghsefhaasdfnkjasdf',
        hasNextPage: true,
      },
      totalCount: 1,
    },
  });

describe('CoveragePageWrapper', () => {
  describe('when the wrapper is used', () => {
    mockApiCall();
    it('renders the passed children', async () => {
      render(
        <CodecovQueryParamsProvider>
          <TestsPage />
        </CodecovQueryParamsProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: '/codecov/tests',
              query: {
                codecovPeriod: '7d',
                integratedOrg: 'some-org-name',
                repository: 'some-repository',
              },
            },
          },
        }
      );

      await waitFor(() => {
        expect(
          screen.getByTestId('page-filter-integrated-org-selector')
        ).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByRole('table')).toBeInTheDocument();
      });
    });
  });
});
