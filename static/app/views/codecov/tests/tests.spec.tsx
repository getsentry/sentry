import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import TestsPage from 'sentry/views/codecov/tests/tests';

// TODO: Make these fixtures
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

// TODO: Make these fixtures
const mockTestResultAggregates = [
  {
    slowestTestsDuration: 6234,
    slowestTestsDurationPercentChange: 0.4,
    totalDuration: 28787,
    totalDurationPercentChange: 0.6,
    totalFails: 1,
    totalFailsPercentChange: 0.42,
    totalSkips: 2,
    totalSkipsPercentChange: -0.23,
    totalSlowTests: 100,
    totalSlowTestsPercentChange: 0,
    flakeCount: 3,
    flakeCountPercentChange: null,
    flakeRate: 4.9326690672322796e-5,
    flakeRatePercentChange: null,
  },
];

const mockApiCall = () => {
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

  MockApiClient.addMockResponse({
    url: `/prevent/owner/some-org-name/repository/some-repository/test-results-aggregates/`,
    method: 'GET',
    body: {
      results: mockTestResultAggregates,
    },
  });
};

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
