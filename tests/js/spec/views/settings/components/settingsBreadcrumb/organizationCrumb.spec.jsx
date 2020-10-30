import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';

import OrganizationCrumb from 'app/views/settings/components/settingsBreadcrumb/organizationCrumb';

jest.unmock('app/utils/recreateRoute');

describe('OrganizationCrumb', function () {
  const {organization, project, routerContext} = initializeOrg();
  const organizations = [
    organization,
    TestStubs.Organization({
      id: '234',
      slug: 'org-slug2',
    }),
  ];

  const switchOrganization = async wrapper => {
    wrapper.find('Crumb').simulate('mouseEnter');
    await tick();
    wrapper.update();
    wrapper.find('AutoCompleteItem').at(1).simulate('click');
  };

  const createWrapper = props =>
    mountWithTheme(
      <OrganizationCrumb
        organizations={organizations}
        organization={organization}
        params={{orgId: organization.slug}}
        {...props}
      />,
      routerContext
    );

  beforeEach(function () {
    browserHistory.push.mockReset();
  });

  it('switches organizations on settings index', async function () {
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

    const wrapper = createWrapper({
      routes,
      route,
    });

    await switchOrganization(wrapper);
    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/');
  });

  it('switches organizations while on API Keys Details route', async function () {
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

    const wrapper = createWrapper({
      routes,
      route,
    });

    await switchOrganization(wrapper);
    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/api-keys/');
  });

  it('switches organizations while on API Keys List route', async function () {
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

    const wrapper = createWrapper({
      routes,
      route,
    });

    await switchOrganization(wrapper);
    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/api-keys/');
  });

  it('switches organizations while in Project Client Keys Details route', async function () {
    const routes = [
      {path: '/', childRoutes: []},
      {path: '/settings/', name: 'Settings', childRoutes: []},
      {name: 'Organization', path: ':orgId/', childRoutes: []},
      {name: 'Project', path: 'projects/:projectId/', childRoutes: []},
      {path: 'keys/', name: 'Client Keys'},
      {path: ':keyId/', name: 'Details'},
    ];

    const route = routes[2];

    const wrapper = createWrapper({
      params: {
        orgId: organization.slug,
        projectId: project.slug,
      },
      routes,
      route,
    });

    await switchOrganization(wrapper);
    expect(browserHistory.push).toHaveBeenCalledWith('/settings/org-slug2/');
  });
});
