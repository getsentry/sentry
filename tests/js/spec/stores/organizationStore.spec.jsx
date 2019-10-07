import OrganizationStore from 'app/stores/organizationStore';
import OrganizationActions from 'app/actions/organizationActions';
import {updateOrganization} from 'app/actionCreators/organizations';

describe('OrganizationStore', function() {
  beforeEach(function() {
    OrganizationStore.reset();
  });

  it('updates correctly', async function() {
    const org = TestStubs.Organization();
    OrganizationActions.update(org);
    await tick();
    expect(OrganizationStore.getOrganization()).toMatchObject(org);
  });

  it('updates correctly from setting changes', async function() {
    const org = TestStubs.Organization();
    updateOrganization(org);
    await tick();
    expect(OrganizationStore.getOrganization()).toMatchObject(org);
  });
});
