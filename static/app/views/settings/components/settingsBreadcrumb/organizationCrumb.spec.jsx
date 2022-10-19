import {browserHistory} from 'react-router';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationCrumb from 'sentry/views/settings/components/settingsBreadcrumb/organizationCrumb';

jest.unmock('sentry/utils/recreateRoute');

describe('OrganizationCrumb', function () {
  const {organization, project, routerContext} = initializeOrg();
  const organizations = [
    organization,
    TestStubs.Organization({
      id: '234',
      slug: 'org-slug2',
    }),
  ];

  const switchOrganization = () => {
    userEvent.hover(screen.getByRole('link'));
    userEvent.click(screen.getAllByRole('option')[1]);
  };

  const renderComponent = props =>
    render(
      <OrganizationCrumb
        organizations={organizations}
        organization={organization}
        params={{orgId: organization.slug}}
        {...props}
      />,
      {context: routerContext}
    );

  beforeEach(function () {
    browserHistory.push.mockReset();
  });

  it('switches organizations on settings index', function () {
    const routes = [
      {path: '/', childRoutes: []},
      {childRoutes: []},
      {path: '/foo/', childRoutes: []},
      {childRoutes: []},
      {path: ':bar', childRoutes: []},
      {path: '/settings/', name: 'Settings'},
      {name: 'Organizations', path: ':orgId/', childRoutes: []},
    ];
    const route = routes[6];

    renderComponent({routes, route});
    switchOrganization();

    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/');
  });

  it('switches organizations while on API Keys Details route', function () {
    const routes = [
      {path: '/', childRoutes: []},
      {childRoutes: []},
      {path: '/foo/', childRoutes: []},
      {childRoutes: []},
      {path: ':bar', childRoutes: []},
      {path: '/settings/', name: 'Settings'},
      {name: 'Organizations', path: ':orgId/', childRoutes: []},
      {childRoutes: []},
      {path: 'api-keys/', name: 'API Key'},
      {path: ':apiKey/', name: 'API Key Details'},
    ];
    const route = routes[6];

    renderComponent({routes, route});
    switchOrganization();

    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/api-keys/');
  });

  it('switches organizations while on API Keys List route', function () {
    const routes = [
      {path: '/', childRoutes: []},
      {childRoutes: []},
      {path: '/foo/', childRoutes: []},
      {childRoutes: []},
      {path: ':bar', childRoutes: []},
      {path: '/settings/', name: 'Settings'},
      {name: 'Organizations', path: ':orgId/', childRoutes: []},
      {childRoutes: []},
      {path: 'api-keys/', name: 'API Key'},
    ];
    const route = routes[6];

    renderComponent({routes, route});
    switchOrganization();

    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/api-keys/');
  });

  it('switches organizations while in Project Client Keys Details route', function () {
    const routes = [
      {path: '/', childRoutes: []},
      {path: '/settings/', name: 'Settings', childRoutes: []},
      {name: 'Organization', path: ':orgId/', childRoutes: []},
      {name: 'Project', path: 'projects/:projectId/', childRoutes: []},
      {path: 'keys/', name: 'Client Keys'},
      {path: ':keyId/', name: 'Details'},
    ];

    const route = routes[2];

    renderComponent({
      params: {
        orgId: organization.slug,
        projectId: project.slug,
      },
      routes,
      route,
    });
    switchOrganization();

    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/');
  });
});
