import OrganizationEnvironmentsStore from 'app/stores/organizationEnvironmentsStore';

describe('OrganizationEnvironmentsStore', function() {
  afterEach(function() {
    OrganizationEnvironmentsStore.init();
  });

  it('get()', function() {
    expect(OrganizationEnvironmentsStore.get()).toEqual({
      environments: null,
      error: null,
    });
  });

  it('loads data from a fetch', async function() {
    OrganizationEnvironmentsStore.onFetchEnvironmentsSuccess(TestStubs.Environments());

    await tick();

    const {environments} = OrganizationEnvironmentsStore.get();

    expect(environments.length).toBe(2);
    expect(environments.map(env => env.name)).toEqual(['production', 'staging']);
    expect(environments.map(env => env.displayName)).toEqual(['Production', 'Staging']);
  });

  it('has the correct loading state', async function() {
    OrganizationEnvironmentsStore.onFetchEnvironments();

    const {environments, error} = OrganizationEnvironmentsStore.get();

    expect(environments).toBeNull();
    expect(error).toBeNull();
  });

  it('has the correct error state', async function() {
    OrganizationEnvironmentsStore.onFetchEnvironmentsError(Error('bad'));

    const {environments, error} = OrganizationEnvironmentsStore.get();

    expect(environments).toBeNull();
    expect(error).not.toBeNull();
  });
});
