import OrganizationEnvironmentsStore from 'app/stores/organizationEnvironmentsStore';

describe('OrganizationEnvironmentsStore', function() {
  afterEach(function() {
    OrganizationEnvironmentsStore.init();
  });

  it('getActive()', function() {
    expect(OrganizationEnvironmentsStore.getActive()).toEqual([]);
  });

  it('loadInitialData()', async function() {
    OrganizationEnvironmentsStore.loadInitialData(TestStubs.Environments());

    await tick();

    const environments = OrganizationEnvironmentsStore.getActive();

    expect(environments.length).toBe(2);
    expect(environments.map(env => env.name)).toEqual(['production', 'staging']);
    expect(environments.map(env => env.displayName)).toEqual(['Production', 'Staging']);
  });
});
