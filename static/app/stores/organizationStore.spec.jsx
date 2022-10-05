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

  it('updates correctly', function () {
    const organization = TestStubs.Organization();
    OrganizationStore.onUpdate(organization);
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
      dirty: false,
    });

    // updates
    organization.slug = 'a new slug';
    OrganizationStore.onUpdate(organization);
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
      dirty: false,
    });
  });

  it('updates correctly from setting changes', function () {
    const organization = TestStubs.Organization();
    OrganizationStore.onUpdate(organization);
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error: null,
      errorType: null,
      organization,
      dirty: false,
    });
  });

  it('errors correctly', function () {
    const error = new Error('uh-oh');
    error.status = 404;
    OrganizationStore.onFetchOrgError(error);
    expect(OrganizationStore.get()).toMatchObject({
      loading: false,
      error,
      errorType: 'ORG_NOT_FOUND',
      organization: null,
      dirty: false,
    });
  });
});
