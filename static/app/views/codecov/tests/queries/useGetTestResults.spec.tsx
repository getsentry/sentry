import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {CodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useInfiniteTestResults} from './useGetTestResults';

const mockTestResultsResponse = {
  pageInfo: {
    endCursor: 'cursor123',
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: 'cursor000',
  },
  results: [
    {
      name: 'test_example_function',
      avgDuration: 0.045,
      commitsFailed: 5,
      failureRate: 0.12,
      flakeRate: 0.08,
      lastDuration: 0.052,
      totalFailCount: 12,
      totalFlakyFailCount: 8,
      totalPassCount: 88,
      totalSkipCount: 2,
      updatedAt: '2024-01-15T10:30:00Z',
    },
    {
      name: 'test_another_function',
      avgDuration: 0.023,
      commitsFailed: 2,
      failureRate: 0.05,
      flakeRate: 0.02,
      lastDuration: 0.025,
      totalFailCount: 5,
      totalFlakyFailCount: 2,
      totalPassCount: 95,
      totalSkipCount: 0,
      updatedAt: '2024-01-15T09:15:00Z',
    },
  ],
  totalCount: 150,
};

const emptyTestResultsResponse = {
  pageInfo: {
    endCursor: null,
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
  },
  results: [],
  totalCount: 0,
};

const codecovContextValue = {
  integratedOrgId: 'org123',
  repository: 'test-repo',
  branch: 'main',
  codecovPeriod: '30d',
  changeContextValue: jest.fn(),
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
}));

describe('useInfiniteTestResults', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    // Clean up all mocks between tests to ensure test isolation
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('fetches test results with no params and returns successful response', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${codecovContextValue.integratedOrgId}/repository/${codecovContextValue.repository}/test-results/`,
      body: mockTestResultsResponse,
      match: [
        MockApiClient.matchQuery({
          interval: 'INTERVAL_30_DAY',
          sortBy: '-COMMITS_WHERE_FAIL',
          branch: 'main',
        }),
      ],
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>
          <CodecovContext.Provider value={codecovContextValue}>
            {children}
          </CodecovContext.Provider>
        </OrganizationContext>
      </QueryClientProvider>
    );

    const {result} = renderHook(() => useInfiniteTestResults({}), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.totalCount).toBe(150);
    expect(result.current.startCursor).toBe('cursor000');
    expect(result.current.endCursor).toBe('cursor123');

    // Verifies that the data is transformed correctly
    expect(result.current.data[0]).toEqual({
      testName: 'test_example_function',
      averageDurationMs: 45, // avgDuration * 1000
      commitsFailed: 5,
      failureRate: 0.12,
      flakeRate: 8, // flakeRate * 100
      lastDuration: 0.052,
      lastRun: '2024-01-15T10:30:00Z',
      isBrokenTest: false, // totalFailCount !== totalPassCount + totalFlakyFailCount + totalSkipCount
    });
  });

  it('fetches test results with navigation and cursor props', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${codecovContextValue.integratedOrgId}/repository/${codecovContextValue.repository}/test-results/`,
      body: mockTestResultsResponse,
      match: [
        MockApiClient.matchQuery({
          interval: 'INTERVAL_30_DAY',
          sortBy: '-COMMITS_WHERE_FAIL',
          branch: 'main',
          cursor: 'next-cursor',
          navigation: 'next',
        }),
      ],
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>
          <CodecovContext.Provider value={codecovContextValue}>
            {children}
          </CodecovContext.Provider>
        </OrganizationContext>
      </QueryClientProvider>
    );

    const {result} = renderHook(
      () =>
        useInfiniteTestResults({
          cursor: 'next-cursor',
          navigation: 'next',
        }),
      {
        wrapper,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.totalCount).toBe(150);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('handles empty results response', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${codecovContextValue.integratedOrgId}/repository/${codecovContextValue.repository}/test-results/`,
      body: emptyTestResultsResponse,
      match: [
        MockApiClient.matchQuery({
          interval: 'INTERVAL_30_DAY',
          sortBy: '-COMMITS_WHERE_FAIL',
          branch: 'main',
        }),
      ],
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>
          <CodecovContext.Provider value={codecovContextValue}>
            {children}
          </CodecovContext.Provider>
        </OrganizationContext>
      </QueryClientProvider>
    );

    const {result} = renderHook(() => useInfiniteTestResults({}), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.startCursor).toBeNull();
    expect(result.current.endCursor).toBeNull();
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it('handles API errors gracefully', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${codecovContextValue.integratedOrgId}/repository/${codecovContextValue.repository}/test-results/`,
      statusCode: 500,
      body: {error: 'Internal Server Error'},
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>
          <CodecovContext.Provider value={codecovContextValue}>
            {children}
          </CodecovContext.Provider>
        </OrganizationContext>
      </QueryClientProvider>
    );

    const {result} = renderHook(() => useInfiniteTestResults({}), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('tests multiple filters and parameter mappings', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    const codecovContextWithFilters = {
      ...codecovContextValue,
      codecovPeriod: '24h',
      branch: 'feature-branch',
    };

    const mockSearchParams = new URLSearchParams(
      'term=integration&filterBy=slowestTests&sort=testName'
    );
    jest.requireMock('react-router-dom').useSearchParams = () => [
      mockSearchParams,
      jest.fn(),
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${codecovContextWithFilters.integratedOrgId}/repository/${codecovContextWithFilters.repository}/test-results/`,
      body: mockTestResultsResponse,
      match: [
        MockApiClient.matchQuery({
          interval: 'INTERVAL_1_DAY', // from codecovPeriod: '24h'
          sortBy: 'NAME', // from sort: 'testName' (no '-' prefix means ascending)
          branch: 'feature-branch', // from context
          term: 'integration', // from search params
          filterBy: 'SLOWEST_TESTS', // from filterBy: 'slowestTests'
        }),
      ],
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>
          <CodecovContext.Provider value={codecovContextWithFilters}>
            {children}
          </CodecovContext.Provider>
        </OrganizationContext>
      </QueryClientProvider>
    );

    const {result} = renderHook(() => useInfiniteTestResults({}), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.totalCount).toBe(150);
  });
});
