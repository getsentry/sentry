import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PreventContext} from 'sentry/components/prevent/context/preventContext';

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

const preventContextValue = {
  integratedOrgId: 'org123',
  repository: 'test-repo',
  branch: 'main',
  preventPeriod: '30d',
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
      url: `/organizations/${organization.slug}/prevent/owner/${preventContextValue.integratedOrgId}/repositories/tokens/`,
      body: mockRepositoryTokensResponse,
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={preventContextValue}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useInfiniteRepositoryTokens, {
      organization,
      additionalWrapper,
      initialProps: {
        cursor: undefined,
        navigation: undefined,
      },
    });

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
      url: `/organizations/${organization.slug}/prevent/owner/${preventContextValue.integratedOrgId}/repositories/tokens/`,
      body: mockRepositoryTokensResponse,
      match: [
        MockApiClient.matchQuery({
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

    const {result} = renderHookWithProviders(useInfiniteRepositoryTokens, {
      organization,
      additionalWrapper,
      initialProps: {
        cursor: 'next-cursor',
        navigation: 'next',
      },
    });

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
      url: `/organizations/${organization.slug}/prevent/owner/${preventContextValue.integratedOrgId}/repositories/tokens/`,
      body: emptyRepositoryTokensResponse,
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={preventContextValue}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useInfiniteRepositoryTokens, {
      organization,
      additionalWrapper,
      initialProps: {
        cursor: undefined,
        navigation: undefined,
      },
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
      url: `/organizations/${organization.slug}/prevent/owner/${preventContextValue.integratedOrgId}/repositories/tokens/`,
      statusCode: 500,
      body: {error: 'Internal Server Error'},
    });

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={preventContextValue}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useInfiniteRepositoryTokens, {
      additionalWrapper,
      organization,
      initialProps: {
        cursor: undefined,
        navigation: undefined,
      },
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('is disabled when integratedOrgId is not provided', () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    const preventContextWithoutOrgId = {
      ...preventContextValue,
      integratedOrgId: '',
    };

    const additionalWrapper = ({children}: {children: React.ReactNode}) => (
      <PreventContext.Provider value={preventContextWithoutOrgId}>
        {children}
      </PreventContext.Provider>
    );

    const {result} = renderHookWithProviders(useInfiniteRepositoryTokens, {
      additionalWrapper,
      organization,
      initialProps: {
        cursor: undefined,
        navigation: undefined,
      },
    });

    expect(result.current.data).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });
});
