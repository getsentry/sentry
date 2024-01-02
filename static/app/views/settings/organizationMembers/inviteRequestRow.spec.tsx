import selectEvent from 'react-select-event';
import {Member as MemberFixture} from 'sentry-fixture/member';
import {Organization} from 'sentry-fixture/organization';
import {Team} from 'sentry-fixture/team';
import {User} from 'sentry-fixture/user';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import TeamStore from 'sentry/stores/teamStore';
import {OrgRole} from 'sentry/types';
import InviteRequestRow from 'sentry/views/settings/organizationMembers/inviteRequestRow';

const roles: OrgRole[] = [
  {
    id: 'admin',
    name: 'Admin',
    desc: 'This is the admin role',
    minimumTeamRole: '',
    allowed: true,
  },
  {
    id: 'member',
    name: 'Member',
    desc: 'This is the member role',
    minimumTeamRole: '',
    allowed: true,
  },
  {
    id: 'owner',
    name: 'Owner',
    desc: 'This is the owner role',
    minimumTeamRole: '',
    allowed: false,
  },
];

describe('InviteRequestRow', function () {
  const orgWithoutAdminAccess = Organization({
    access: [],
  });
  const orgWithAdminAccess = Organization({
    access: ['member:admin'],
  });
  const inviteRequestBusy: Record<string, boolean> = {};

  const inviteRequest = MemberFixture({
    user: null,
    inviterName: User().name,
    inviteStatus: 'requested_to_be_invited',
    role: 'member',
    teams: ['myteam'],
  });

  const joinRequest = MemberFixture({
    user: null,
    inviteStatus: 'requested_to_join',
    role: 'member',
    teams: ['myteam'],
  });

  it('renders request to be invited', function () {
    render(
      <InviteRequestRow
        organization={orgWithoutAdminAccess}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={() => {}}
        onDeny={() => {}}
        onUpdate={() => {}}
        allRoles={roles}
      />
    );

    expect(screen.getByText(inviteRequest.email)).toBeInTheDocument();
    expect(
      screen.getByText(`Requested by ${inviteRequest.inviterName}`)
    ).toBeInTheDocument();
  });

  it('renders request to join', function () {
    render(
      <InviteRequestRow
        organization={orgWithoutAdminAccess}
        inviteRequest={joinRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={() => {}}
        onDeny={() => {}}
        onUpdate={() => {}}
        allRoles={roles}
      />
    );

    expect(screen.getByText(joinRequest.email)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Approve'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Deny'})).toBeInTheDocument();
  });

  it('admin can approve invite request', async function () {
    const mockApprove = jest.fn();
    const mockDeny = jest.fn();

    render(
      <InviteRequestRow
        organization={orgWithAdminAccess}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={mockApprove}
        onDeny={mockDeny}
        onUpdate={() => {}}
        allRoles={roles}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Approve'}));

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('confirm-button'));

    expect(mockApprove).toHaveBeenCalledWith(inviteRequest);
    expect(mockDeny).not.toHaveBeenCalled();
  });

  it('admin can deny invite request', async function () {
    const mockApprove = jest.fn();
    const mockDeny = jest.fn();

    render(
      <InviteRequestRow
        organization={orgWithAdminAccess}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={mockApprove}
        onDeny={mockDeny}
        onUpdate={() => {}}
        allRoles={roles}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Deny'}));

    expect(mockDeny).toHaveBeenCalledWith(inviteRequest);
    expect(mockApprove).not.toHaveBeenCalled();
  });

  it('non-admin can not approve or deny invite request', function () {
    render(
      <InviteRequestRow
        organization={orgWithoutAdminAccess}
        inviteRequest={inviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={() => {}}
        onDeny={() => {}}
        onUpdate={() => {}}
        allRoles={roles}
      />
    );

    expect(screen.getByRole('button', {name: 'Approve'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Deny'})).toBeDisabled();
  });

  it('admin can change role and teams', async function () {
    const adminInviteRequest = MemberFixture({
      user: null,
      inviterName: User().name,
      inviteStatus: 'requested_to_be_invited',
      role: 'admin',
      teams: ['myteam'],
    });

    void TeamStore.loadInitialData([
      Team({id: '1', slug: 'one'}),
      Team({id: '2', slug: 'two'}),
    ]);
    const mockUpdate = jest.fn();

    render(
      <InviteRequestRow
        organization={orgWithAdminAccess}
        inviteRequest={adminInviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={() => {}}
        onDeny={() => {}}
        onUpdate={mockUpdate}
        allRoles={roles}
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
    const ownerInviteRequest = MemberFixture({
      user: null,
      inviterName: User().name,
      inviteStatus: 'requested_to_be_invited',
      role: 'owner',
      teams: ['myteam'],
    });

    const mockUpdate = jest.fn();

    render(
      <InviteRequestRow
        organization={orgWithoutAdminAccess}
        inviteRequest={ownerInviteRequest}
        inviteRequestBusy={inviteRequestBusy}
        onApprove={() => {}}
        onDeny={() => {}}
        onUpdate={mockUpdate}
        allRoles={roles}
      />
    );

    expect(screen.getByRole('button', {name: 'Approve'})).toBeDisabled();
  });
});
