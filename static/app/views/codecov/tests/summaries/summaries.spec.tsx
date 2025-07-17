import {render, screen} from 'sentry-test/reactTestingLibrary';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {Summaries} from 'sentry/views/codecov/tests/summaries/summaries';

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

const mockApiCall = () =>
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/prevent/owner/some-org-name/repository/some-repository/test-results-aggregates/`,
    method: 'GET',
    body: {
      results: mockTestResultAggregates,
    },
  });

describe('Summaries', () => {
  it('renders the CIEfficiency component', () => {
    mockApiCall();
    render(
      <CodecovQueryParamsProvider>
        <Summaries />
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

    const ciEfficiencyPanel = screen.getByText('CI Run Efficiency');
    expect(ciEfficiencyPanel).toBeInTheDocument();
  });
});
