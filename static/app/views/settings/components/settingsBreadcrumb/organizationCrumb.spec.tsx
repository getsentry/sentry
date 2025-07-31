import {OrganizationFixture} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import type {Config} from 'sentry/types/system';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

import {OrganizationCrumb} from './organizationCrumb';
import type {RouteWithName, SettingsBreadcrumbProps} from './types';

jest.unmock('sentry/utils/recreateRoute');

describe('OrganizationCrumb', function () {
  let initialData: Config;
  const {organization, project, routerProps} = initializeOrg();
  const organizations = [
    organization,
    OrganizationFixture({
      id: '234',
      slug: 'org-slug2',
    }),
  ];

  beforeEach(() => {
    OrganizationsStore.init();
    OrganizationsStore.load(organizations);

    initialData = ConfigStore.getState();
  });

  const switchOrganization = async () => {
    await userEvent.hover(screen.getByRole('link'));
    await userEvent.click(screen.getAllByRole('option')[1]!);
  };

  const renderComponent = (props: Omit<SettingsBreadcrumbProps, 'isLast'>) =>
    render(<OrganizationCrumb {...routerProps} {...props} isLast={false} />, {
      organization,
    });

  afterEach(function () {
    ConfigStore.loadInitialData(initialData);
  });

  it('switches organizations on settings index', async function () {
    const route = {name: 'Organizations', path: ':orgId/'};
    const routes: RouteWithName[] = [
      {path: '/'},
      {},
      {path: '/foo/'},
      {},
      {path: ':bar'},
      {path: '/settings/', name: 'Settings'},
      route,
    ];

    const result = renderComponent({routes, route});
    await switchOrganization();

    expect(result.router.location).toMatchObject({
      pathname: '/settings/org-slug2/',
    });
  });

  it('switches organizations while on API Keys Details route', async function () {
    const route = {name: 'Organizations', path: ':orgId/'};
    const routes: RouteWithName[] = [
      {path: '/'},
      {},
      {path: '/foo/'},
      {},
      {path: ':bar'},
      {path: '/settings/', name: 'Settings'},
      route,
      {},
      {path: 'api-keys/', name: 'API Key'},
      {path: ':apiKey/', name: 'API Key Details'},
    ];

    const result = renderComponent({routes, route});

    await switchOrganization();

    expect(result.router.location).toMatchObject({
      pathname: '/settings/org-slug2/api-keys/',
    });
  });

  it('switches organizations while on API Keys List route', async function () {
    const route = {name: 'Organizations', path: ':orgId/'};
    const routes: RouteWithName[] = [
      {path: '/'},
      {},
      {path: '/foo/'},
      {},
      {path: ':bar'},
      {path: '/settings/', name: 'Settings'},
      route,
      {},
      {path: 'api-keys/', name: 'API Key'},
    ];

    const result = renderComponent({routes, route});
    await switchOrganization();

    expect(result.router.location).toMatchObject({
      pathname: '/settings/org-slug2/api-keys/',
    });
  });

  it('switches organizations while in Project Client Keys Details route', async function () {
    const route = {name: 'Organization', path: ':orgId/'};
    const routes: RouteWithName[] = [
      {path: '/'},
      {path: '/settings/', name: 'Settings'},
      route,
      {name: 'Project', path: 'projects/:projectId/'},
      {path: 'keys/', name: 'Client Keys'},
      {path: ':keyId/', name: 'Details'},
    ];

    const result = render(
      <OrganizationCrumb {...routerProps} route={route} routes={routes} isLast={false} />,
      {
        organization,

        initialRouterConfig: {
          location: {pathname: `/projects/${project.slug}/`},
          route: '/projects/:projectId/',
        },
      }
    );
    await switchOrganization();

    expect(result.router.location).toMatchObject({
      pathname: '/settings/org-slug2/',
    });
  });

  it('switches organizations for child route with customer domains', async function () {
    ConfigStore.set('customerDomain', {
      subdomain: 'albertos-apples',
      organizationUrl: 'https://albertos-apples.sentry.io',
      sentryUrl: 'https://sentry.io',
    });
    ConfigStore.set('features', new Set(['system:multi-region']));

    const route = {name: 'Organizations', path: ':orgId/'};
    const routes: RouteWithName[] = [
      {path: '/'},
      {},
      {path: '/foo/'},
      {},
      {path: ':bar'},
      {path: '/settings/', name: 'Settings'},
      route,
      {},
      {path: 'api-keys/', name: 'API Key'},
    ];
    const orgs = [
      organization,
      OrganizationFixture({
        id: '234',
        slug: 'acme',
        links: {
          organizationUrl: 'https://acme.sentry.io',
          regionUrl: 'https://us.sentry.io',
        },
      }),
    ];

    OrganizationsStore.load(orgs);

    renderComponent({routes, route});
    await switchOrganization();

    expect(testableWindowLocation.assign).toHaveBeenCalledWith(
      'https://acme.sentry.io/settings/api-keys/'
    );
  });
});
