import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import DiscoverContainer from 'sentry/views/discover';

describe('DiscoverContainer', () => {
  const organization = OrganizationFixture({
    slug: 'org-slug',
    features: ['discover-basic'],
  });
  const deprecatedOrg = OrganizationFixture({
    slug: 'org-slug',
    features: [
      'discover-basic',
      'deprecate-discover',
      'discover-saved-queries-deprecation',
    ],
  });

  it('redirects /explore/discover/ to /explore/errors/ when the org has the deprecation flags', async () => {
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

  it('does not redirect /explore/errors/', () => {
    render(<DiscoverContainer />, {
      organization,
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
