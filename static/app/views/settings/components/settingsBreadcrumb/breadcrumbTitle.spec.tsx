import {GitHubIntegrationProviderFixture} from 'sentry-fixture/githubIntegrationProvider';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {BreadcrumbTitle} from './breadcrumbTitle';
import {BreadcrumbProvider} from './context';
import {SettingsBreadcrumb} from '.';

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
  it('combines a typed settings title with parent menus and page-specific breadcrumbs', async () => {
    const organization = OrganizationFixture();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/config/integrations/`,
      body: {providers: [GitHubIntegrationProviderFixture()]},
    });
    render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb
          params={{orgId: organization.slug, integrationSlug: 'github'}}
        />
        <SettingsPageHeader
          title={{
            type: 'page-title',
            label: 'Workspace',
          }}
          breadcrumbs={[{type: 'link', label: 'Configurations', to: '/configurations/'}]}
        />
      </BreadcrumbProvider>,
      {
        organization,
        initialRouterConfig: {
          route: '/settings/:orgId/',
          location: {pathname: `/settings/${organization.slug}/integrations/github/`},
          children: [
            {
              path: 'integrations/',
              handle: {name: 'Integrations', path: 'integrations/'},
              children: [
                {
                  path: ':integrationSlug/',
                  handle: {name: 'Integration Details', path: ':integrationSlug'},
                  element: <div />,
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
    expect(within(heading).queryByRole('link')).not.toBeInTheDocument();
    expect(within(heading).queryByText('GitHub')).not.toBeInTheDocument();
    expect(within(heading).queryByText('Configurations')).not.toBeInTheDocument();
  });

  it('renders settings breadcrumbs and replaces title', () => {
    render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb params={{}} />
        <BreadcrumbTitle title="Last Title" />
      </BreadcrumbProvider>,
      {
        initialRouterConfig: {
          route: '/',
          location: {pathname: '/one/two/three/'},
          children: routeChildren,
        },
      }
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(2);
    expect(screen.getByText('Last Title')).toBeInTheDocument();
  });

  it('cleans up routes', () => {
    const {rerender, router} = render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb params={{}} />
        <BreadcrumbTitle title="Last Title" />
      </BreadcrumbProvider>,
      {
        initialRouterConfig: {
          route: '/',
          location: {pathname: '/one/two/three/'},
          children: routeChildren,
        },
      }
    );

    const crumbs = screen.getAllByRole('link');

    expect(crumbs).toHaveLength(2);
    expect(screen.getByText('Last Title')).toBeInTheDocument();

    // Simulate navigating up a level, trimming the last title
    router.navigate('/one/two/');

    rerender(
      <BreadcrumbProvider>
        <SettingsBreadcrumb params={{}} />
      </BreadcrumbProvider>
    );

    const crumbsNext = screen.getAllByRole('link');

    expect(crumbsNext).toHaveLength(1);
    expect(screen.getByText('Two')).toBeInTheDocument();
  });

  it('uses the explicit title for document integrations', () => {
    render(
      <BreadcrumbProvider>
        <SettingsBreadcrumb params={{integrationSlug: 'example-doc'}} />
        <BreadcrumbTitle title="Example Documentation" />
      </BreadcrumbProvider>,
      {
        initialRouterConfig: {
          route: '/',
          location: {pathname: '/document-integrations/example-doc'},
          children: documentIntegrationRouteChildren,
        },
      }
    );

    expect(screen.getByText('Example Documentation')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'example-doc'})).not.toBeInTheDocument();
  });
});
