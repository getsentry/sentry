import {browserHistory} from 'react-router';
import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationsStore from 'sentry/stores/organizationsStore';
import {Config} from 'sentry/types';
import {OrganizationCrumb} from 'sentry/views/settings/components/settingsBreadcrumb/organizationCrumb';

import {RouteWithName} from './types';

jest.unmock('sentry/utils/recreateRoute');

describe('OrganizationCrumb', function () {
  let initialData: Config;
  const {organization, project, routerContext, routerProps} = initializeOrg();
  const organizations = [
    organization,
    Organization({
      id: '234',
      slug: 'org-slug2',
    }),
  ];

  beforeEach(() => {
    OrganizationsStore.init();
    OrganizationsStore.load(organizations);
  });

  const switchOrganization = async () => {
    await userEvent.hover(screen.getByRole('link'));
    await userEvent.click(screen.getAllByRole('option')[1]);
  };

  const renderComponent = (
    props: Partial<
      Pick<React.ComponentProps<typeof OrganizationCrumb>, 'route' | 'routes' | 'params'>
    >
  ) =>
    render(<OrganizationCrumb {...routerProps} params={{}} {...props} />, {
      context: routerContext,
      organization,
    });

  beforeEach(function () {
    initialData = window.__initialData;
    jest.mocked(browserHistory.push).mockReset();
    jest.mocked(window.location.assign).mockReset();
  });
  afterEach(function () {
    window.__initialData = initialData;
  });

  it('switches organizations on settings index', async function () {
    const routes: RouteWithName[] = [
      {path: '/'},
      {},
      {path: '/foo/'},
      {},
      {path: ':bar'},
      {path: '/settings/', name: 'Settings'},
      {name: 'Organizations', path: ':orgId/'},
    ];
    const route = routes[6];

    renderComponent({routes, route});
    await switchOrganization();

    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/');
  });

  it('switches organizations while on API Keys Details route', async function () {
    const routes: RouteWithName[] = [
      {path: '/'},
      {},
      {path: '/foo/'},
      {},
      {path: ':bar'},
      {path: '/settings/', name: 'Settings'},
      {name: 'Organizations', path: ':orgId/'},
      {},
      {path: 'api-keys/', name: 'API Key'},
      {path: ':apiKey/', name: 'API Key Details'},
    ];
    const route = routes[6];

    renderComponent({routes, route});
    await switchOrganization();

    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/api-keys/');
  });

  it('switches organizations while on API Keys List route', async function () {
    const routes: RouteWithName[] = [
      {path: '/'},
      {},
      {path: '/foo/'},
      {},
      {path: ':bar'},
      {path: '/settings/', name: 'Settings'},
      {name: 'Organizations', path: ':orgId/'},
      {},
      {path: 'api-keys/', name: 'API Key'},
    ];
    const route = routes[6];

    renderComponent({routes, route});
    await switchOrganization();

    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/api-keys/');
  });

  it('switches organizations while in Project Client Keys Details route', async function () {
    const routes: RouteWithName[] = [
      {path: '/'},
      {path: '/settings/', name: 'Settings'},
      {name: 'Organization', path: ':orgId/'},
      {name: 'Project', path: 'projects/:projectId/'},
      {path: 'keys/', name: 'Client Keys'},
      {path: ':keyId/', name: 'Details'},
    ];

    const route = routes[2];

    renderComponent({
      params: {projectId: project.slug},
      routes,
      route,
    });
    await switchOrganization();

    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/');
  });

  it('switches organizations for child route with customer domains', async function () {
    window.__initialData = {
      customerDomain: {
        subdomain: 'albertos-apples',
        organizationUrl: 'https://albertos-apples.sentry.io',
        sentryUrl: 'https://sentry.io',
      },
    } as Config;

    const routes: RouteWithName[] = [
      {path: '/'},
      {},
      {path: '/foo/'},
      {},
      {path: ':bar'},
      {path: '/settings/', name: 'Settings'},
      {name: 'Organizations', path: ':orgId/'},
      {},
      {path: 'api-keys/', name: 'API Key'},
    ];
    const route = routes[6];
    const orgs = [
      organization,
      Organization({
        id: '234',
        slug: 'acme',
        features: ['customer-domains'],
        links: {
          organizationUrl: 'https://acme.sentry.io',
          regionUrl: 'https://us.sentry.io',
        },
      }),
    ];

    OrganizationsStore.load(orgs);

    renderComponent({routes, route});
    await switchOrganization();

    expect(window.location.assign).toHaveBeenCalledWith(
      'https://acme.sentry.io/settings/api-keys/'
    );
  });
});
