import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {CodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useInfiniteRepositoryTokens} from './useInfiniteRepositoryTokens';

const mockRepositoryTokensResponse = {
  pageInfo: {
    endCursor: 'cursor123',
    hasNextPage: true,
    hasPreviousPage: false,
    startCursor: 'cursor000',
  },
  results: [
    {
      name: 'test-repo-one',
      token: 'sk_test_token_12345abcdef',
    },
    {
      name: 'test-repo-two',
      token: 'sk_test_token_67890ghijkl',
    },
  ],
  totalCount: 25,
};

const emptyRepositoryTokensResponse = {
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

describe('useInfiniteRepositoryTokens', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches repository tokens with no params and returns successful response', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${codecovContextValue.integratedOrgId}/repositories/tokens/`,
      body: mockRepositoryTokensResponse,
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
        useInfiniteRepositoryTokens({
          cursor: undefined,
          navigation: undefined,
        }),
      {
        wrapper,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.totalCount).toBe(25);
    expect(result.current.startCursor).toBe('cursor000');
    expect(result.current.endCursor).toBe('cursor123');

    // Verifies that the data is transformed correctly
    expect(result.current.data[0]).toEqual({
      name: 'test-repo-one',
      token: 'sk_test_token_12345abcdef',
    });
    expect(result.current.data[1]).toEqual({
      name: 'test-repo-two',
      token: 'sk_test_token_67890ghijkl',
    });
  });

  it('fetches repository tokens with navigation and cursor props', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${codecovContextValue.integratedOrgId}/repositories/tokens/`,
      body: mockRepositoryTokensResponse,
      match: [
        MockApiClient.matchQuery({
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
        useInfiniteRepositoryTokens({
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
    expect(result.current.totalCount).toBe(25);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('handles empty results response', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/${codecovContextValue.integratedOrgId}/repositories/tokens/`,
      body: emptyRepositoryTokensResponse,
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
        useInfiniteRepositoryTokens({
          cursor: undefined,
          navigation: undefined,
        }),
      {
        wrapper,
      }
    );

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
      url: `/organizations/${organization.slug}/prevent/owner/${codecovContextValue.integratedOrgId}/repositories/tokens/`,
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

    const {result} = renderHook(
      () =>
        useInfiniteRepositoryTokens({
          cursor: undefined,
          navigation: undefined,
        }),
      {
        wrapper,
      }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('is disabled when integratedOrgId is not provided', () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    const codecovContextWithoutOrgId = {
      ...codecovContextValue,
      integratedOrgId: '',
    };

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>
          <CodecovContext.Provider value={codecovContextWithoutOrgId}>
            {children}
          </CodecovContext.Provider>
        </OrganizationContext>
      </QueryClientProvider>
    );

    const {result} = renderHook(
      () =>
        useInfiniteRepositoryTokens({
          cursor: undefined,
          navigation: undefined,
        }),
      {
        wrapper,
      }
    );

    expect(result.current.data).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });
});
