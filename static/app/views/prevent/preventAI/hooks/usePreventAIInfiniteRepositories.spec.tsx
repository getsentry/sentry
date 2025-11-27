import {OrganizationFixture} from 'sentry-fixture/organization';
import {RepositoryFixture} from 'sentry-fixture/repository';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {RepositoryStatus} from 'sentry/types/integrations';
import type {Repository} from 'sentry/types/integrations';

import {useInfiniteRepositories} from './usePreventAIInfiniteRepositories';

const mockRepositories: Repository[] = [
  RepositoryFixture({
    id: '1',
    name: 'test-org/repo-one',
    integrationId: 'integration-123',
    externalId: 'ext-1',
    status: RepositoryStatus.ACTIVE,
  }),
  RepositoryFixture({
    id: '2',
    name: 'test-org/repo-two',
    integrationId: 'integration-123',
    externalId: 'ext-2',
    status: RepositoryStatus.ACTIVE,
  }),
];

const mockRepositoriesPage2: Repository[] = [
  RepositoryFixture({
    id: '3',
    name: 'test-org/repo-three',
    integrationId: 'integration-123',
    externalId: 'ext-3',
    status: RepositoryStatus.ACTIVE,
  }),
];

describe('useInfiniteRepositories', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches repositories with integration ID', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
        }),
      ],
      headers: {
        Link: '<https://sentry.io/api/0/organizations/test-org/repos/>; rel="next"; results="true"; cursor="next-cursor"',
      },
    });

    const {result} = renderHookWithProviders(
      () =>
        useInfiniteRepositories({
          integrationId: 'integration-123',
        }),
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.data?.pages[0]?.[0]).toEqual(mockRepositories);
    expect(result.current.hasNextPage).toBe(true);
  });

  it('fetches repositories with search term', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    const filteredRepos = [mockRepositories[0]];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: filteredRepos,
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
          query: 'repo-one',
        }),
      ],
    });

    const {result} = renderHookWithProviders(
      () =>
        useInfiniteRepositories({
          integrationId: 'integration-123',
          searchTerm: 'repo-one',
        }),
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0]?.[0]).toEqual(filteredRepos);
  });

  it('fetches next page when fetchNextPage is called', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    // First page
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
        }),
      ],
      headers: {
        Link: '<https://sentry.io/api/0/organizations/test-org/repos/>; rel="next"; results="true"; cursor="next-cursor"',
      },
    });

    // Second page
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: mockRepositoriesPage2,
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
          cursor: 'next-cursor',
        }),
      ],
      headers: {
        Link: '<https://sentry.io/api/0/organizations/test-org/repos/>; rel="previous"; results="true"; cursor="prev-cursor"',
      },
    });

    const {result} = renderHookWithProviders(
      () =>
        useInfiniteRepositories({
          integrationId: 'integration-123',
        }),
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);

    // Fetch next page
    result.current.fetchNextPage();

    await waitFor(() => {
      expect(result.current.data?.pages).toHaveLength(2);
    });

    expect(result.current.data?.pages[0]?.[0]).toEqual(mockRepositories);
    expect(result.current.data?.pages[1]?.[0]).toEqual(mockRepositoriesPage2);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('handles empty results', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [],
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
        }),
      ],
    });

    const {result} = renderHookWithProviders(
      () =>
        useInfiniteRepositories({
          integrationId: 'integration-123',
        }),
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0]?.[0]).toEqual([]);
    expect(result.current.hasNextPage).toBe(false);
  });

  it('handles API errors gracefully', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
        }),
      ],
    });

    const {result} = renderHookWithProviders(
      () =>
        useInfiniteRepositories({
          integrationId: 'integration-123',
        }),
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('is disabled when integration ID is not provided', () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: mockRepositories,
    });

    const {result} = renderHookWithProviders(
      () =>
        useInfiniteRepositories({
          integrationId: '',
        }),
      {
        organization,
      }
    );

    // Query should not be triggered
    expect(result.current.isPending).toBe(true);
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('calls API with correct query parameters', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
        }),
      ],
    });

    const {result} = renderHookWithProviders(
      () =>
        useInfiniteRepositories({
          integrationId: 'integration-123',
          searchTerm: undefined,
        }),
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockRequest).toHaveBeenCalledWith(
      '/organizations/test-org/repos/',
      expect.objectContaining({
        query: expect.objectContaining({
          integration_id: 'integration-123',
          status: 'active',
        }),
      })
    );
  });

  it('updates results when search term changes', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: mockRepositories,
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
        }),
      ],
    });

    const {result, rerender} = renderHookWithProviders(
      (props: {searchTerm?: string}) =>
        useInfiniteRepositories({
          integrationId: 'integration-123',
          searchTerm: props.searchTerm,
        }),
      {
        organization,
        initialProps: {searchTerm: undefined as string | undefined},
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.pages[0]?.[0]).toHaveLength(2);

    // Update with search term
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: [mockRepositories[0]],
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
          query: 'repo-one',
        }),
      ],
    });

    rerender({searchTerm: 'repo-one'});

    await waitFor(() => {
      expect(result.current.data?.pages[0]?.[0]).toHaveLength(1);
    });
  });

  it('filters out repositories with null externalId', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});
    const reposResponse: Repository[] = [
      RepositoryFixture({
        id: '1',
        name: 'test-org/repo-one',
        integrationId: 'integration-123',
        externalId: 'ext-1',
        status: RepositoryStatus.ACTIVE,
      }),
      {
        ...RepositoryFixture({
          id: '999',
          name: 'test-org/repo-hidden',
          integrationId: 'integration-123',
          // @ts-expect-error test value intentionally violates type
          externalId: null,
          status: RepositoryStatus.ACTIVE,
        }),
      },
    ];

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/repos/`,
      body: reposResponse,
      match: [
        MockApiClient.matchQuery({
          integration_id: 'integration-123',
          status: 'active',
        }),
      ],
    });

    const {result} = renderHookWithProviders(
      () =>
        useInfiniteRepositories({
          integrationId: 'integration-123',
        }),
      {
        organization,
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const data = result.current.data?.pages?.[0]?.[0] ?? [];
    expect(data).toHaveLength(1);
    expect(data?.[0]?.id).toBe('1');
    expect(data.find(r => r.externalId === null)).toBeUndefined();
  });
});
