import OrganizationEnvironmentsStore from 'sentry/stores/organizationEnvironmentsStore';

describe('OrganizationEnvironmentsStore', function () {
  beforeEach(() => {
    OrganizationEnvironmentsStore.init();
  });
  afterEach(() => {
    OrganizationEnvironmentsStore.teardown();
  });

  it('get()', function () {
    expect(OrganizationEnvironmentsStore.getState()).toEqual({
      environments: null,
      error: null,
    });
  });

  it('loads data from a fetch', async function () {
    OrganizationEnvironmentsStore.onFetchEnvironmentsSuccess(TestStubs.Environments());

    await tick();

    const {environments} = OrganizationEnvironmentsStore.getState();

    expect(environments).toHaveLength(3);
    expect(environments.map(env => env.name)).toEqual([
      'production',
      'staging',
      'STAGING',
    ]);
    expect(environments.map(env => env.displayName)).toEqual([
      'production',
      'staging',
      'STAGING',
    ]);
  });

  it('has the correct loading state', function () {
    OrganizationEnvironmentsStore.onFetchEnvironments();

    const {environments, error} = OrganizationEnvironmentsStore.getState();

    expect(environments).toBeNull();
    expect(error).toBeNull();
  });

  it('has the correct error state', function () {
    OrganizationEnvironmentsStore.onFetchEnvironmentsError(Error('bad'));

    const {environments, error} = OrganizationEnvironmentsStore.getState();

    expect(environments).toBeNull();
    expect(error).not.toBeNull();
  });
});
