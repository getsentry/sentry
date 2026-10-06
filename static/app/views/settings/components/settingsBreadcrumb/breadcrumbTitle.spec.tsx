import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {BreadcrumbTitle} from './breadcrumbTitle';

jest.unmock('sentry/utils/recreateRoute');

const routeChildren = [
  {
    path: 'one',
    handle: {name: 'One', path: '/one/'},
    children: [
      {
        path: 'two',
        handle: {name: 'Two', path: '/two/'},
        element: <div />,
        children: [
          {
            path: 'three',
            handle: {name: 'Three', path: '/three/'},
            element: <div />,
          },
        ],
      },
    ],
  },
];

const documentIntegrationRouteChildren = [
  {
    path: 'document-integrations',
    handle: {name: 'Integrations', path: 'document-integrations/'},
    children: [
      {
        path: ':integrationSlug',
        handle: {name: 'Details', path: ':integrationSlug'},
        element: <div />,
      },
    ],
  },
];

describe('BreadcrumbTitle', () => {
  it('preserves settings parent destinations on a customer domain', () => {
    const organization = OrganizationFixture();
    const customerDomain = ConfigStore.get('customerDomain');
    ConfigStore.set('customerDomain', {
      subdomain: organization.slug,
      organizationUrl: `https://${organization.slug}.sentry.io`,
      sentryUrl: 'https://sentry.io',
    });
    try {
      render(<BreadcrumbTitle title="New Integration" />, {
        organization,
        initialRouterConfig: {
          route: '/settings/',
          location: {pathname: '/settings/integrations/new/'},
          children: [
            {
              path: 'integrations/',
              handle: {name: 'Integrations', path: '/settings/integrations/'},
              children: [
                {
                  path: 'new/',
                  handle: {name: 'New Integration', path: 'new/'},
                  element: <div />,
                },
              ],
            },
          ],
        },
      });
      expect(screen.getByRole('link', {name: 'Integrations'})).toHaveAttribute(
        'href',
        '/settings/integrations/'
      );
    } finally {
      ConfigStore.set('customerDomain', customerDomain);
    }
  });

  it.each([false, true])(
    'combines a typed title with integration parents (nested route: %s)',
    async nested => {
      const organization = OrganizationFixture();
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/config/integrations/`,
        body: {providers: [GitHubIntegrationProviderFixture()]},
      });
      render(
        <SettingsPageHeader
          title={{
            type: 'page-title',
            label: 'Workspace',
          }}
          breadcrumbs={[{type: 'link', label: 'Configurations', to: '/configurations/'}]}
        />,
        {
          organization,
          initialRouterConfig: {
            route: '/settings/:orgId/',
            location: {
              pathname: `/settings/${organization.slug}/integrations/github/${nested ? 'configurations/' : ''}`,
            },
            children: [
              {
                path: 'integrations/',
                handle: {name: 'Integrations', path: 'integrations/'},
                children: [
                  {
                    path: ':integrationSlug/',
                    handle: {name: 'Integration Details', path: ':integrationSlug'},
                    element: <div />,
                    children: [
                      {
                        path: 'configurations/',
                        handle: {name: 'Configurations', path: 'configurations/'},
                        element: <div />,
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }
      );
      expect(await screen.findByRole('link', {name: /GitHub/})).toBeInTheDocument();
      expect(screen.getByRole('link', {name: 'Configurations'})).toHaveAttribute(
        'href',
        '/configurations/'
      );
      const heading = screen.getByRole('heading', {name: 'Workspace', level: 1});
      expect(screen.getAllByRole('heading', {level: 1})).toHaveLength(1);
      expect(within(heading).queryByRole('link')).not.toBeInTheDocument();
      expect(within(heading).queryByText('GitHub')).not.toBeInTheDocument();
      expect(within(heading).queryByText('Configurations')).not.toBeInTheDocument();
    }
  );

  it('renders settings breadcrumbs and replaces title', () => {
    render(<BreadcrumbTitle title="Last Title" />, {
      initialRouterConfig: {
        route: '/',
        location: {pathname: '/one/two/three/'},
        children: routeChildren,
      },
    });

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(2);
    expect(
      screen.getByRole('heading', {name: 'Last Title', level: 1})
    ).toBeInTheDocument();
    expect(screen.getAllByRole('heading', {level: 1})).toHaveLength(1);
  });

  it('uses the explicit title for document integrations', () => {
    render(<BreadcrumbTitle title="Example Documentation" />, {
      initialRouterConfig: {
        route: '/',
        location: {pathname: '/document-integrations/example-doc'},
        children: documentIntegrationRouteChildren,
      },
    });

    expect(screen.getByText('Example Documentation')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'example-doc'})).not.toBeInTheDocument();
  });
});
