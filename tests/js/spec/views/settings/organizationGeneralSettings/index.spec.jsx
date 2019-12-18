import {browserHistory} from 'react-router';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme} from 'sentry-test/enzyme';
import OrganizationGeneralSettings from 'app/views/settings/organizationGeneralSettings';

jest.mock('jquery');

describe('OrganizationGeneralSettings', function() {
  let organization;
  let routerContext;
  const ENDPOINT = '/organizations/org-slug/';

  beforeEach(function() {
    ({organization, routerContext} = initializeOrg());
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/auth-provider/`,
      method: 'GET',
    });
  });

  it('can enable "early adopter"', async function() {
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

  it('changes org slug and redirects to new slug', async function() {
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

    wrapper.find('SaveButton').simulate('click');
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

  it('disables the entire form if user does not have write access', async function() {
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
    expect(
      wrapper
        .find('PermissionAlert')
        .first()
        .text()
    ).toEqual(
      'These settings can only be edited by users with the organization owner or manager role.'
    );
  });

  it('does not have remove organization button', async function() {
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

  it('can remove organization when org admin', async function() {
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

    // Lists projects in modal
    expect(wrapper.find('Modal .ref-projects')).toHaveLength(1);
    expect(wrapper.find('Modal .ref-projects li').text()).toBe('project');

    // Confirm delete
    wrapper.find('Modal Portal Button[priority="danger"]').simulate('click');
    expect(mock).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'DELETE',
      })
    );
  });

  it('shows require2fa switch', async function() {
    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );

    await tick();
    wrapper.update();
    expect(wrapper.find('Switch[name="require2FA"]')).toHaveLength(1);
  });

  it('enables require2fa but cancels confirm modal', async function() {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
    });
    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );

    await tick();
    wrapper.update();
    expect(wrapper.find('Switch[name="require2FA"]')).toHaveLength(1);
    wrapper.find('Switch[name="require2FA"]').simulate('click');
    expect(wrapper.find('Field[name="require2FA"] ModalDialog')).toHaveLength(1);

    // Cancel
    wrapper
      .find('Field[name="require2FA"] ModalDialog .modal-footer Button')
      .first()
      .simulate('click');
    expect(wrapper.find('Field[name="require2FA"] ModalDialog')).toHaveLength(0);
    expect(wrapper.find('Switch[name="require2FA"]').prop('isActive')).toBe(false);
    expect(mock).not.toHaveBeenCalled();
  });

  it('enables require2fa with confirm modal', async function() {
    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
    });

    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );

    await tick();
    wrapper.update();
    expect(wrapper.find('Switch[name="require2FA"]')).toHaveLength(1);
    wrapper.find('Switch[name="require2FA"]').simulate('click');
    expect(wrapper.find('Field[name="require2FA"] ModalDialog')).toHaveLength(1);

    // Confirm
    wrapper
      .find(
        'Field[name="require2FA"] ModalDialog .modal-footer Button[priority="primary"]'
      )
      .simulate('click');
    expect(wrapper.find('Field[name="require2FA"] ModalDialog')).toHaveLength(0);
    expect(wrapper.find('Switch[name="require2FA"]').prop('isActive')).toBe(true);
    expect(mock).toHaveBeenCalledWith(
      '/organizations/org-slug/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          require2FA: true,
        },
      })
    );
  });

  it('returns to "off" if switch enable fails (e.g. API error)', async function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/',
      method: 'PUT',
      statusCode: 500,
    });

    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings
        params={{orgId: organization.slug}}
        organization={organization}
      />,
      routerContext
    );

    await tick();
    wrapper.update();
    wrapper.find('Switch[name="require2FA"]').simulate('click');

    // hide console.error for this test
    jest.spyOn(console, 'error').mockImplementation(() => {});
    // Confirm but has API failure
    wrapper
      .find(
        'Field[name="require2FA"] ModalDialog .modal-footer Button[priority="primary"]'
      )
      .simulate('click');

    await tick();
    wrapper.update();
    expect(wrapper.find('Switch[name="require2FA"]').prop('isActive')).toBe(false);
    // eslint-disable-next-line no-console
    console.error.mockRestore();
  });

  it('renders join request switch', async function() {
    const wrapper = mountWithTheme(
      <OrganizationGeneralSettings params={{orgId: organization.slug}} />,
      TestStubs.routerContext([{organization}])
    );

    await tick();
    wrapper.update();
    expect(wrapper.find('Switch[name="allowJoinRequests"]').exists()).toBe(true);
  });

  it('does not render join request switch with SSO enabled', async function() {
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
