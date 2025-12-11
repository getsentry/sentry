import {OrganizationFixture} from 'sentry-fixture/organization';

import {makeTestQueryClient} from 'sentry-test/queryClient';
import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import {QueryClient, QueryClientProvider} from 'sentry/utils/queryClient';

import {useUpdateOrganization} from './useUpdateOrganization';

describe('useUpdateOrganization', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    queryClient = makeTestQueryClient();
    OrganizationStore.reset();
  });

  it('updates OrganizationStore on successful mutation', async () => {
    const organization = OrganizationFixture({
      slug: 'test-org',
      name: 'Original Name',
    });

    // Set up initial store state
    OrganizationStore.onUpdate(organization);

    const updatedOrganization = {
      ...organization,
      name: 'Updated Name',
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: updatedOrganization,
    });

    const {result} = renderHook(() => useUpdateOrganization(organization), {
      wrapper: ({children}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    // Verify initial state
    expect(OrganizationStore.get().organization?.name).toBe('Original Name');

    // Trigger mutation
    result.current.mutate({name: 'Updated Name'});

    // OrganizationStore should be optimistically updated
    await waitFor(() => {
      expect(OrganizationStore.get().organization?.name).toBe('Updated Name');
    });

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Verify OrganizationStore still has the updated value
    expect(OrganizationStore.get().organization?.name).toBe('Updated Name');
  });

  it('rolls back OrganizationStore on mutation error', async () => {
    const organization = OrganizationFixture({
      slug: 'test-org',
      name: 'Original Name',
    });

    // Set up initial store state
    OrganizationStore.onUpdate(organization);

    const onUpdateSpy = jest.spyOn(OrganizationStore, 'onUpdate');

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      statusCode: 500,
      body: {detail: 'Internal Server Error'},
    });

    const {result} = renderHook(() => useUpdateOrganization(organization), {
      wrapper: ({children}) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    // Verify initial state
    expect(OrganizationStore.get().organization?.name).toBe('Original Name');

    // Trigger mutation and wait for it to fail
    act(() => {
      result.current.mutateAsync({name: 'Updated Name'}).catch(() => {
        // Expected to throw
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Verify OrganizationStore.onUpdate was called twice:
    // 1. Optimistic update with new name
    // 2. Rollback with original name
    expect(onUpdateSpy).toHaveBeenCalledTimes(2);
    expect(onUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({name: 'Updated Name'})
    );
    expect(onUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({name: 'Original Name'})
    );

    // Verify final state is rolled back
    expect(OrganizationStore.get().organization?.name).toBe('Original Name');
  });
});
