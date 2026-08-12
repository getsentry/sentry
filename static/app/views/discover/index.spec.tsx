import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import DiscoverContainer from 'sentry/views/discover';

describe('DiscoverContainer', () => {
  const deprecatedOrg = OrganizationFixture({
    slug: 'org-slug',
    features: [
      'discover-basic',
      'deprecate-discover',
      'discover-saved-queries-deprecation',
    ],
  });
  const nonDeprecatedOrg = OrganizationFixture({
    slug: 'org-slug',
    features: ['discover-basic'],
  });

  it('redirects /explore/errors/ to /explore/discover/ when the org lacks the deprecation flag', async () => {
    const {router} = render(<DiscoverContainer />, {
      organization: nonDeprecatedOrg,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/errors/queries/',
          query: {foo: 'bar'},
        },
        route: '/organizations/:orgId/explore/errors/:tab/',
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/explore/discover/queries/'
      );
    });
    expect(router.location.query).toEqual({foo: 'bar'});
  });

  it('does not redirect /explore/discover/ URLs when the org lacks the deprecation flag', () => {
    render(<DiscoverContainer />, {
      organization: nonDeprecatedOrg,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/discover/queries/',
        },
        route: '/organizations/:orgId/explore/discover/:tab/',
      },
    });

    expect(
      screen.queryByText("You don't have access to this feature")
    ).not.toBeInTheDocument();
  });

  it('redirects /explore/discover/ to /explore/errors/ when the org has the deprecation flag', async () => {
    const {router} = render(<DiscoverContainer />, {
      organization: deprecatedOrg,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/discover/queries/',
          query: {foo: 'bar'},
        },
        route: '/organizations/:orgId/explore/discover/:tab/',
      },
    });

    await waitFor(() => {
      expect(router.location.pathname).toBe(
        '/organizations/org-slug/explore/errors/queries/'
      );
    });
    expect(router.location.query).toEqual({foo: 'bar'});
  });

  it('does not redirect /explore/errors/ URLs when the org has the deprecation flag', () => {
    render(<DiscoverContainer />, {
      organization: deprecatedOrg,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/errors/queries/',
        },
        route: '/organizations/:orgId/explore/errors/:tab/',
      },
    });

    expect(
      screen.queryByText("You don't have access to this feature")
    ).not.toBeInTheDocument();
  });
});
