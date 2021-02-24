import React from 'react';
import {browserHistory} from 'react-router';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountGlobalModal} from 'sentry-test/modal';

import OrganizationGeneralSettings from 'app/views/settings/organizationGeneralSettings';

describe('OrganizationGeneralSettings', function () {
  let organization;
  let routerContext;
  const ENDPOINT = '/organizations/org-slug/';

  beforeEach(function () {
    ({organization, routerContext} = initializeOrg());
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
    });
  });

  it('can enable "early adopter"', async function () {
    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    await tick();
    wrapper.update();
    wrapper.find('Switch[id="isEarlyAdopter"]').simulate('click');
    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        data: {isEarlyAdopter: true},
      })
    );
  });

  it('changes org slug and redirects to new slug', async function () {
    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
    });

    await tick();
    wrapper.update();
    // Change slug
    wrapper
      .find('input[id="slug"]')
      .simulate('change', {target: {value: 'new-slug'}})
      .simulate('blur');

    wrapper.find('button[aria-label="Save"]').simulate('click');
    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        data: {slug: 'new-slug'},
      })
    );

    await tick();
    // Not sure why this needs to be async, but it does
    expect(browserHistory.replace).toHaveBeenCalledWith('/settings/new-slug/');
  });

  it('disables the entire form if user does not have write access', async function () {
    ({organization, routerContext} = initializeOrg({
      organization: TestStubs.Organization({access: ['org:read']}),
    }));
    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings
        routes={[]}
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('Form FormField[disabled=false]')).toHaveLength(0);
    expect(wrapper.find('PermissionAlert').first().text()).toEqual(
      'These settings can only be edited by users with the organization owner or manager role.'
    );
  });

  it('does not have remove organization button', async function () {
    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings
        params={{orgId: organization.slug}}
        organization={TestStubs.Organization({
          projects: [{slug: 'project'}],
          access: ['org:write'],
        })}
      />,
      routerContext
    );

    await tick();
    wrapper.update();
    expect(wrapper.find('Confirm[priority="danger"]')).toHaveLength(0);
  });

  it('can remove organization when org admin', async function () {
    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings
        params={{orgId: organization.slug}}
        organization={TestStubs.Organization({
          projects: [{slug: 'project'}],
          access: ['org:admin'],
        })}
      />,
      routerContext
    );
    const mock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'DELETE',
    });

    await tick();
    wrapper.update();
    wrapper.find('Confirm[priority="danger"]').simulate('click');

    const modal = await mountGlobalModal();

    // Lists projects in modal
    expect(modal.find('.ref-projects')).toHaveLength(1);
    expect(modal.find('.ref-projects li').text()).toBe('project');

    // Confirm delete
    modal.find('Button[priority="danger"]').simulate('click');
    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('does not render join request switch with SSO enabled', async function () {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
      body: TestStubs.AuthProvider(),
    });

    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings params={{orgId: organization.slug}} />,
      TestStubs.routerContext([{organization}])
    );

    await tick();
    wrapper.update();
    expect(wrapper.find('Switch[name="allowJoinRequests"]').exists()).toBe(false);
  });
});
