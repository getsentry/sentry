import selectEvent from 'react-select-event';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

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
    render(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithoutAdminAccess}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        allRoles={roles}
      />
    );

    expect(screen.getByText(inviteRequest.email)).toBeInTheDocument();
    expect(screen.getByText(inviteRequest.inviterName)).toBeInTheDocument();
  });

  it('renders request to join', function () {
    render(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithoutAdminAccess}
        inviteRequest={joinRequest}
        inviteRequestBusy={inviteRequestBusy}
        allRoles={roles}
      />
    );

    expect(screen.getByText(joinRequest.email)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Approve'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Deny'})).toBeInTheDocument();
  });

  it('admin can approve invite request', function () {
    const mockApprove = jest.fn();
    const mockDeny = jest.fn();

    render(
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

    userEvent.click(screen.getByRole('button', {name: 'Approve'}));

    renderGlobalModal();
    userEvent.click(screen.getByTestId('confirm-button'));

    expect(mockApprove).toHaveBeenCalledWith(inviteRequest);
    expect(mockDeny).not.toHaveBeenCalled();
  });

  it('admin can deny invite request', function () {
    const mockApprove = jest.fn();
    const mockDeny = jest.fn();

    render(
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

    userEvent.click(screen.getByRole('button', {name: 'Deny'}));

    expect(mockDeny).toHaveBeenCalledWith(inviteRequest);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('non-admin can not approve or deny invite request', function () {
    render(
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

    expect(screen.getByRole('button', {name: 'Approve'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Deny'})).toBeDisabled();
  });

  it('admin can change role and teams', async function () {
    const adminInviteRequest = TestStubs.Member({
      user: null,
      inviterName: TestStubs.User().name,
      inviterId: TestStubs.User().id,
      inviteStatus: 'requested_to_be_invited',
      role: 'admin',
      teams: ['myteam'],
    });

    void TeamStore.loadInitialData([
      {id: '1', slug: 'one'},
      {id: '2', slug: 'two'},
    ]);
    const mockUpdate = jest.fn();

    render(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithAdminAccess}
        inviteRequest={adminInviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        allRoles={roles}
        onUpdate={mockUpdate}
      />
    );

    // Select role from first select input
    await selectEvent.select(screen.getAllByRole('textbox')[0], 'Member');
    expect(mockUpdate).toHaveBeenCalledWith({role: 'member'});

    // Select teams from first select input
    await selectEvent.select(screen.getAllByRole('textbox')[1], ['#one']);
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

    render(
      <InviteRequestRow
        orgId={orgId}
        organization={orgWithoutAdminAccess}
        inviteRequest={ownerInviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        allRoles={roles}
        onUpdate={mockUpdate}
      />
    );

    expect(screen.getByRole('button', {name: 'Approve'})).toBeDisabled();
  });
});
