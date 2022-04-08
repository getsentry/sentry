import {updateOrganization} from 'sentry/actionCreators/organizations';
import OrganizationActions from 'sentry/actions/organizationActions';
import OrganizationStore from 'sentry/stores/organizationStore';

describe('OrganizationStore', function () {
  beforeEach(function () {
    OrganizationStore.reset();
  });

  it('starts with loading state', function () {
    expect(OrganizationStore.get()).toMatchObject({
      loading: true,
      error: null,
      errorType: null,
      organization: null,
      dirty: false,
    });
  });

  it('updates correctly', async function () {
    const organization = TestStubs.Organization();
    OrganizationActions.update(organization);
    await tick();
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
      dirty: false,
    });

    // updates
    organization.slug = 'a new slug';
    OrganizationActions.update(organization);
    await tick();
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
      dirty: false,
    });
  });

  it('updates correctly from setting changes', async function () {
    const organization = TestStubs.Organization();
    updateOrganization(organization);
    await tick();
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
      dirty: false,
    });
  });

  it('errors correctly', async function () {
    const error = new Error('uh-oh');
    error.status = 404;
    OrganizationActions.fetchOrgError(error);
    await tick();
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error,
      errorType: 'ORG_NOT_FOUND',
      organization: null,
      dirty: false,
    });
  });
});
