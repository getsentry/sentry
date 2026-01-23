import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PreventContext} from 'sentry/components/prevent/context/preventContext';

import {useInfiniteTestResults} from './useGetTestResults';

const mockTestResultsResponse = {
  pageInfo: {
    endCursor: 'cursor123',
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: 'cursor000',
  },
  defaultBranch: 'main',
  results: [
    {
      name: 'test_example_function',
      avgDuration: 0.045,
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
  defaultBranch: 'another',
  pageInfo: {
    endCursor: null,
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: null,
  },
  results: [],
  totalCount: 0,
};

const preventContextValue = {
  integratedOrgId: 'org123',
  repository: 'test-repo',
  branch: 'main',
  preventPeriod: '30d',
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
    jest.restoreAllMocks();
  });

  it('fetches test results with no params and returns successful response', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${preventContextValue.integratedOrgId}/repository/${preventContextValue.repository}/test-results/`,
      body: mockTestResultsResponse,
      match: [
        MockApiClient.matchQuery({
          interval: 'INTERVAL_30_DAY',
          sortBy: '-RUNS_FAILED',
          branch: 'main',
        }),
      ],
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={preventContextValue}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useInfiniteTestResults, {
      additionalWrapper,
      organization,
      initialProps: {},
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data.testResults).toHaveLength(2);
    expect(result.current.totalCount).toBe(150);
    expect(result.current.startCursor).toBe('cursor000');
    expect(result.current.endCursor).toBe('cursor123');

    // Verifies that the data is transformed correctly
    expect(result.current.data.defaultBranch).toBe('main');
    expect(result.current.data.testResults[0]).toEqual({
      testName: 'test_example_function',
      averageDurationMs: 45, // avgDuration * 1000
      failureRate: 0.12,
      flakeRate: 8, // flakeRate * 100
      lastDuration: 0.052,
      lastRun: '2024-01-15T10:30:00Z',
      isBrokenTest: false, // totalFailCount !== totalPassCount + totalFlakyFailCount + totalSkipCount
      totalFailCount: 12,
      totalFlakyFailCount: 8,
      totalPassCount: 88,
      totalSkipCount: 2,
    });
  });

  it('fetches test results with navigation and cursor props', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${preventContextValue.integratedOrgId}/repository/${preventContextValue.repository}/test-results/`,
      body: mockTestResultsResponse,
      match: [
        MockApiClient.matchQuery({
          interval: 'INTERVAL_30_DAY',
          sortBy: '-RUNS_FAILED',
          branch: 'main',
          cursor: 'next-cursor',
          navigation: 'next',
        }),
      ],
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={preventContextValue}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useInfiniteTestResults, {
      additionalWrapper,
      organization,
      initialProps: {
        cursor: 'next-cursor',
        navigation: 'next',
      },
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data.testResults).toHaveLength(2);
    expect(result.current.totalCount).toBe(150);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('handles empty results response', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${preventContextValue.integratedOrgId}/repository/${preventContextValue.repository}/test-results/`,
      body: emptyTestResultsResponse,
      match: [
        MockApiClient.matchQuery({
          interval: 'INTERVAL_30_DAY',
          sortBy: '-RUNS_FAILED',
          branch: 'main',
        }),
      ],
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={preventContextValue}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useInfiniteTestResults, {
      additionalWrapper,
      organization,
      initialProps: {},
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data.testResults).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
    expect(result.current.startCursor).toBeNull();
    expect(result.current.endCursor).toBeNull();
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it('handles API errors gracefully', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${preventContextValue.integratedOrgId}/repository/${preventContextValue.repository}/test-results/`,
      statusCode: 500,
      body: {error: 'Internal Server Error'},
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={preventContextValue}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useInfiniteTestResults, {
      additionalWrapper,
      organization,
      initialProps: {},
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.data.testResults).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('tests multiple filters and parameter mappings', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    const preventContextWithFilters = {
      ...preventContextValue,
      preventPeriod: '24h',
      branch: 'feature-branch',
    };

    const mockSearchParams = new URLSearchParams(
      'term=integration&filterBy=slowestTests&sort=totalFailCount'
    );
    jest.requireMock('react-router-dom').useSearchParams = () => [
      mockSearchParams,
      jest.fn(),
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${preventContextWithFilters.integratedOrgId}/repository/${preventContextWithFilters.repository}/test-results/`,
      body: mockTestResultsResponse,
      match: [
        MockApiClient.matchQuery({
          interval: 'INTERVAL_1_DAY', // from preventPeriod: '24h'
          sortBy: 'RUNS_FAILED', // from sort: 'totalFailCount' (no '-' prefix means ascending)
          branch: 'feature-branch', // from context
          term: 'integration', // from search params
          filterBy: 'SLOWEST_TESTS', // from filterBy: 'slowestTests'
        }),
      ],
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={preventContextWithFilters}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useInfiniteTestResults, {
      additionalWrapper,
      organization,
      initialProps: {},
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data.testResults).toHaveLength(2);
    expect(result.current.totalCount).toBe(150);
  });
});
