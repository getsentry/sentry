import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {OrganizationStore} from 'sentry/stores/organizationStore';

import {useOrganizationMutationOptions} from './useOrganizationMutationOptions';

const mutationFnContext = expect.objectContaining({client: expect.anything()});

describe('useOrganizationMutationOptions', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    OrganizationStore.reset();
  });

  it('optimistically updates OrganizationStore via onMutate', () => {
    const organization = OrganizationFixture({
      slug: 'test-org',
      name: 'Original Name',
    });

    OrganizationStore.onUpdate(organization);

    const {result} = renderHookWithProviders(() =>
      useOrganizationMutationOptions(organization)
    );

    expect(OrganizationStore.get().organization?.name).toBe('Original Name');

    const context = result.current.onMutate!({name: 'Updated Name'}, mutationFnContext);

    expect(OrganizationStore.get().organization?.name).toBe('Updated Name');
    expect(context).toEqual(
      expect.objectContaining({
        previousOrganization: expect.objectContaining({name: 'Original Name'}),
      })
    );
  });

  it('calls the correct API endpoint via mutationFn', async () => {
    const organization = OrganizationFixture({slug: 'test-org'});

    const mockPut = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'PUT',
      body: {...organization, name: 'Updated Name'},
    });

    const {result} = renderHookWithProviders(() =>
      useOrganizationMutationOptions(organization)
    );

    await result.current.mutationFn!({name: 'Updated Name'}, mutationFnContext);

    expect(mockPut).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/`,
      expect.objectContaining({data: {name: 'Updated Name'}, method: 'PUT'})
    );
  });

  it('rolls back OrganizationStore on error', async () => {
    const organization = OrganizationFixture({
      slug: 'test-org',
      name: 'Original Name',
    });

    OrganizationStore.onUpdate(organization);

    const {result} = renderHookWithProviders(() =>
      useOrganizationMutationOptions(organization)
    );

    const onUpdateSpy = jest.spyOn(OrganizationStore, 'onUpdate');

    const context = await result.current.onMutate!(
      {name: 'Updated Name'},
      mutationFnContext
    );
    expect(OrganizationStore.get().organization?.name).toBe('Updated Name');

    result.current.onError!(
      new Error('Server error'),
      {name: 'Updated Name'},
      context,
      mutationFnContext
    );

    expect(OrganizationStore.get().organization?.name).toBe('Original Name');
    expect(onUpdateSpy).toHaveBeenCalledWith(
      expect.objectContaining({name: 'Original Name'})
    );
  });
});
