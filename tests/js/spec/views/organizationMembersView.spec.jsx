import React from 'react';

import {Client} from 'app/api';
import {mount} from 'enzyme';
import ConfigStore from 'app/stores/configStore';
import OrganizationMembersView from 'app/views/settings/organization/members/organizationMembersView';

jest.mock('app/api');

describe('OrganizationMembersView', function() {
  let members = TestStubs.Members();
  let currentUser = members[1];
  let defaultProps = {
    orgId: 'org-slug',
    orgName: 'Organization Name',
    status: '',
    routes: [],
    requireLink: false,
    memberCanLeave: false,
    canAddMembers: false,
    canRemoveMembers: false,
    currentUser,
    onSendInvite: () => {},
    onRemove: () => {},
    onLeave: () => {},
  };
  let organization = TestStubs.Organization({
    access: ['member:admin', 'org:admin'],
  });

  beforeAll(function() {
    sinon.stub(ConfigStore, 'get', () => currentUser);
  });

  afterAll(function() {
    ConfigStore.get.restore();
  });

  beforeEach(function() {
    Client.clearMockResponses();
    Client.addMockResponse({
      url: '/organizations/org-id/members/',
      method: 'GET',
      body: TestStubs.Members(),
    });
    Client.addMockResponse({
      url: '/organizations/org-id/access-requests/',
      method: 'GET',
      body: [],
    });
    Client.addMockResponse({
      url: '/organizations/org-id/auth-provider/',
      method: 'GET',
      body: {
        ...TestStubs.AuthProvider(),
        require_link: true,
      },
    });
  });

  it('can remove a member', async function() {
    let deleteMock = Client.addMockResponse({
      url: `/organizations/org-id/members/${members[0].id}/`,
      method: 'DELETE',
    });

    let wrapper = mount(
      <OrganizationMembersView
        {...defaultProps}
        params={{
          orgId: 'org-id',
        }}
      />,
      TestStubs.routerContext([{organization}])
    );

    wrapper
      .find('Button[icon="icon-circle-subtract"]')
      .at(0)
      .simulate('click');

    await tick();

    // Confirm modal
    wrapper.find('ModalDialog Button[priority="primary"]').simulate('click');
    await tick();

    expect(deleteMock).toHaveBeenCalled();
  });

  it('can leave org', async function() {
    let deleteMock = Client.addMockResponse({
      url: `/organizations/org-id/members/${members[1].id}/`,
      method: 'DELETE',
    });

    let wrapper = mount(
      <OrganizationMembersView
        {...defaultProps}
        params={{
          orgId: 'org-id',
        }}
      />,
      TestStubs.routerContext([{organization}])
    );

    wrapper
      .find('Button[priority="danger"]')
      .at(0)
      .simulate('click');

    await tick();

    // Confirm modal
    wrapper.find('ModalDialog Button[priority="primary"]').simulate('click');
    await tick();

    expect(deleteMock).toHaveBeenCalled();
  });
});
