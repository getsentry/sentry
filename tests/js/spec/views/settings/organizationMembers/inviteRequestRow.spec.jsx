import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select';

import InviteRequestRow from 'app/views/settings/organizationMembers/inviteRequestRow';

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
  const inviteRequestBusy = new Map();

  const inviteRequest = TestStubs.Member({
    user: null,
    inviterName: TestStubs.User().name,
    inviteStatus: 'requested_to_be_invited',
    role: 'member',
  });

  const joinRequest = TestStubs.Member({
    user: null,
    inviteStatus: 'requested_to_join',
    role: 'member',
  });

  it('renders request to be invited', function () {
    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        allTeams={[]}
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
        inviteRequest={joinRequest}
        inviteRequestBusy={inviteRequestBusy}
        allTeams={[]}
        allRoles={roles}
      />
    );

    expect(wrapper.find('UserName').text()).toBe(joinRequest.email);
    expect(wrapper.find('JoinRequestIndicator').exists()).toBe(true);
  });

  it('can approve invite request', function () {
    const mockApprove = jest.fn();
    const mockDeny = jest.fn();

    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={mockApprove}
        onDeny={mockDeny}
        allTeams={[]}
        allRoles={roles}
      />
    );

    wrapper.find('button[aria-label="Approve"]').simulate('click');
    wrapper.find('button[aria-label="Confirm"]').simulate('click');
    expect(mockApprove).toHaveBeenCalledWith(inviteRequest);
    expect(mockDeny).not.toHaveBeenCalled();
  });

  it('can deny invite request', function () {
    const mockApprove = jest.fn();

    const mockDeny = jest.fn();
    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={mockApprove}
        onDeny={mockDeny}
        allTeams={[]}
        allRoles={roles}
      />
    );

    wrapper.find('button[aria-label="Deny"]').simulate('click');
    expect(mockDeny).toHaveBeenCalledWith(inviteRequest);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('can change role and teams', function () {
    const adminInviteRequest = TestStubs.Member({
      user: null,
      inviterName: TestStubs.User().name,
      inviteStatus: 'requested_to_be_invited',
      role: 'admin',
    });

    const mockUpdate = jest.fn();

    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        inviteRequest={adminInviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        allTeams={[{slug: 'one'}, {slug: 'two'}]}
        allRoles={roles}
        onUpdate={mockUpdate}
      />
    );

    selectByValue(wrapper, 'member', {name: 'role', control: true});
    expect(mockUpdate).toHaveBeenCalledWith({role: 'member'});

    selectByValue(wrapper, 'one', {name: 'teams', control: true});
    expect(mockUpdate).toHaveBeenCalledWith({teams: ['one']});
  });

  it('cannot be approved when invitee role is not allowed', function () {
    const ownerInviteRequest = TestStubs.Member({
      user: null,
      inviterName: TestStubs.User().name,
      inviteStatus: 'requested_to_be_invited',
      role: 'owner',
    });

    const mockUpdate = jest.fn();

    const wrapper = mountWithTheme(
      <InviteRequestRow
        orgId={orgId}
        inviteRequest={ownerInviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        allTeams={[{slug: 'one'}, {slug: 'two'}]}
        allRoles={roles}
        onUpdate={mockUpdate}
      />
    );

    expect(wrapper.find('button[aria-label="Approve"]').props()['aria-disabled']).toBe(
      true
    );
  });
});
