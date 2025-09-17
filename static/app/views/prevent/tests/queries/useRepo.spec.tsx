import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {OrganizationContext} from 'sentry/views/organizationContext';

import {useRepo} from './useRepo';

describe('useRepo', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches repository data successfully', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});
    const mockRepoData = {
      testAnalyticsEnabled: true,
      uploadToken: 'test-token-123',
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/org123/repository/test-repo/`,
      body: mockRepoData,
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    );

    const {result} = renderHook(
      () =>
        useRepo({
          organizationSlug: organization.slug,
          integratedOrgId: 'org123',
          repository: 'test-repo',
        }),
      {wrapper}
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockRepoData);
    expect(result.current.data?.testAnalyticsEnabled).toBe(true);
    expect(result.current.data?.uploadToken).toBe('test-token-123');
  });

  it('handles API errors gracefully', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/owner/org123/repository/test-repo/`,
      statusCode: 404,
      body: {detail: 'Repository not found'},
    });

    const wrapper = ({children}: {children: React.ReactNode}) => (
      <QueryClientProvider client={makeTestQueryClient()}>
        <OrganizationContext value={organization}>{children}</OrganizationContext>
      </QueryClientProvider>
    );

    const {result} = renderHook(
      () =>
        useRepo({
          organizationSlug: organization.slug,
          integratedOrgId: 'org123',
          repository: 'test-repo',
        }),
      {wrapper}
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
    expect(result.current.data).toBeUndefined();
  });
});
