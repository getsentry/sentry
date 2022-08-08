import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';
import {act} from 'sentry-test/reactTestingLibrary';
import {selectByValue} from 'sentry-test/select-new';

import TeamStore from 'sentry/stores/teamStore';
import InviteRequestRow from 'sentry/views/settings/organizationMembers/inviteRequestRow';

const roles = [
  {
    id: 'admin',
    name: 'Admin',
    desc: 'This is the admin role',
    allowed: true,
  },
  {
    id: 'member',
    name: 'Member',
    desc: 'This is the member role',
    allowed: true,
  },
  {
    id: 'owner',
    name: 'Owner',
    desc: 'This is the owner role',
    allowed: false,
  },
];

describe('InviteRequestRow', function () {
  const orgId = 'org-slug';
  const orgWithoutAdminAccess = TestStubs.Organization({
    access: [],
  });
  const orgWithAdminAccess = TestStubs.Organization({
    access: ['member:admin'],
  });
  const inviteRequestBusy = new Map();

  const inviteRequest = TestStubs.Member({
    user: null,
    inviterName: TestStubs.User().name,
    inviterId: TestStubs.User().id,
    inviteStatus: 'requested_to_be_invited',
    role: 'member',
    teams: ['myteam'],
  });

  const joinRequest = TestStubs.Member({
    user: null,
    inviteStatus: 'requested_to_join',
    role: 'member',
    teams: ['myteam'],
  });

  it('renders request to be invited', function () {
    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithoutAdminAccess}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        allRoles={roles}
      />
    );

    expect(wrapper.find('UserName').text()).toBe(inviteRequest.email);
    expect(wrapper.find('Description').text().includes(inviteRequest.inviterName)).toBe(
      true
    );
  });

  it('renders request to join', function () {
    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithoutAdminAccess}
        inviteRequest={joinRequest}
        inviteRequestBusy={inviteRequestBusy}
        allRoles={roles}
      />
    );

    expect(wrapper.find('UserName').text()).toBe(joinRequest.email);
    expect(wrapper.find('JoinRequestIndicator').exists()).toBe(true);
  });

  it('admin can approve invite request', async function () {
    const mockApprove = jest.fn();
    const mockDeny = jest.fn();

    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithAdminAccess}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={mockApprove}
        onDeny={mockDeny}
        allRoles={roles}
      />
    );

    wrapper.find('button[aria-label="Approve"]').simulate('click');

    const modal = await mountGlobalModal();
    modal.find('button[aria-label="Confirm"]').simulate('click');

    expect(mockApprove).toHaveBeenCalledWith(inviteRequest);
    expect(mockDeny).not.toHaveBeenCalled();
  });

  it('admin can deny invite request', function () {
    const mockApprove = jest.fn();

    const mockDeny = jest.fn();
    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithAdminAccess}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={mockApprove}
        onDeny={mockDeny}
        allRoles={roles}
      />
    );

    wrapper.find('button[aria-label="Deny"]').simulate('click');
    expect(mockDeny).toHaveBeenCalledWith(inviteRequest);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('non-admin can not approve or deny invite request', function () {
    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithoutAdminAccess}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={() => {}}
        onDeny={() => {}}
        allRoles={roles}
      />
    );

    expect(wrapper.find('button[aria-label="Deny"]').prop('aria-disabled')).toBe(true);
    expect(wrapper.find('button[aria-label="Approve"]').prop('aria-disabled')).toBe(true);
  });

  it('admin can change role and teams', function () {
    const adminInviteRequest = TestStubs.Member({
      user: null,
      inviterName: TestStubs.User().name,
      inviterId: TestStubs.User().id,
      inviteStatus: 'requested_to_be_invited',
      role: 'admin',
      teams: ['myteam'],
    });

    act(
      () =>
        void TeamStore.loadInitialData([
          {id: '1', slug: 'one'},
          {id: '2', slug: 'two'},
        ])
    );
    const mockUpdate = jest.fn();

    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithAdminAccess}
        inviteRequest={adminInviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        allRoles={roles}
        onUpdate={mockUpdate}
      />
    );

    selectByValue(wrapper, 'member', {name: 'role', control: true});
    expect(mockUpdate).toHaveBeenCalledWith({role: 'member'});

    selectByValue(wrapper, 'one', {name: 'teams', control: true});
    expect(mockUpdate).toHaveBeenCalledWith({teams: ['one']});

    TeamStore.reset();
  });

  it('cannot be approved when invitee role is not allowed', function () {
    const ownerInviteRequest = TestStubs.Member({
      user: null,
      inviterName: TestStubs.User().name,
      inviterId: TestStubs.User().id,
      inviteStatus: 'requested_to_be_invited',
      role: 'owner',
      teams: ['myteam'],
    });

    const mockUpdate = jest.fn();

    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithoutAdminAccess}
        inviteRequest={ownerInviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        allRoles={roles}
        onUpdate={mockUpdate}
      />
    );

    expect(wrapper.find('button[aria-label="Approve"]').props()['aria-disabled']).toBe(
      true
    );
  });
});
