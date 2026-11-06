import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import {OrganizationStore} from 'sentry/stores/organizationStore';

import {OrganizationHomeRedirect} from './organizationHomeRedirect';

function renderRedirect(organization = OrganizationFixture()) {
  return render(<OrganizationHomeRedirect />, {
    organization,
    initialRouterConfig: {
      location: {pathname: `/organizations/${organization.slug}/`},
      route: '/organizations/:orgId/',
    },
  });
}

describe('OrganizationHomeRedirect', () => {
  beforeEach(() => {
    OrganizationStore.reset();
  });

  it.each([
    {features: [], pathname: '/organizations/org-slug/issues/'},
    {features: ['universal-inbox'], pathname: '/organizations/org-slug/inbox/'},
    {features: ['issue-inbox'], pathname: '/organizations/org-slug/issues/inbox/'},
    {
      features: ['issue-inbox', 'universal-inbox'],
      pathname: '/organizations/org-slug/issues/inbox/',
    },
  ])('redirects to $pathname with features $features', async ({features, pathname}) => {
    const organization = OrganizationFixture({features});
    OrganizationStore.onUpdate(organization);

    const {router} = renderRedirect(organization);

    await waitFor(() => expect(router.location.pathname).toBe(pathname));
  });

  it('waits for the organization from the URL to load', async () => {
    OrganizationStore.onUpdate(
      OrganizationFixture({slug: 'other-org', features: ['issue-inbox']})
    );
    const organization = OrganizationFixture({features: ['issue-inbox']});

    const {router} = renderRedirect(organization);
    expect(router.location.pathname).toBe('/organizations/org-slug/');

    act(() => OrganizationStore.onUpdate(organization));

    await waitFor(() =>
      expect(router.location.pathname).toBe('/organizations/org-slug/issues/inbox/')
    );
  });
});
