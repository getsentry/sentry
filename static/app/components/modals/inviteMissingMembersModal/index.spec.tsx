import selectEvent from 'react-select-event';
import styled from '@emotion/styled';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import InviteMissingMembersModal, {
  InviteMissingMembersModalProps,
} from 'sentry/components/modals/inviteMissingMembersModal';
import TeamStore from 'sentry/stores/teamStore';
import {OrgRole} from 'sentry/types';

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
] as OrgRole[];

describe('InviteMissingMembersModal', function () {
  const team = TestStubs.Team();
  const org = TestStubs.Organization({access: ['member:write'], teams: [team]});
  TeamStore.loadInitialData([team]);
  const missingMembers = TestStubs.MissingMembers();

  const styledWrapper = styled(c => c.children);
  const modalProps: InviteMissingMembersModalProps = {
    Body: styledWrapper(),
    Header: p => <span>{p.children}</span>,
    Footer: styledWrapper(),
    closeModal: () => {},
    CloseButton: makeCloseButton(() => {}),
    organization: TestStubs.Organization(),
    missingMembers: [],
    invitableRoles: [],
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/me/`,
      method: 'GET',
      body: {roles},
    });
  });

  it('renders with empty table when no missing members', function () {
    render(<InviteMissingMembersModal {...modalProps} />);

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    // 1 checkbox column + 4 content columns
    expect(screen.queryAllByTestId('table-header')).toHaveLength(5);
  });

  it('does not render without org:write', function () {
    const organization = TestStubs.Organization({access: []});
    render(<InviteMissingMembersModal {...modalProps} organization={organization} />);

    expect(
      screen.queryByRole('heading', {name: 'Invite Your Dev Team'})
    ).not.toBeInTheDocument();
  });

  it('disables invite button if no members selected', function () {
    render(<InviteMissingMembersModal {...modalProps} missingMembers={missingMembers} />);

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    expect(screen.getByLabelText('Send Invites')).toBeDisabled();
    expect(screen.getByText('Invite missing members')).toBeInTheDocument();
  });

  it('enables and disables invite button when toggling one checkbox', async function () {
    render(<InviteMissingMembersModal {...modalProps} missingMembers={missingMembers} />);

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select hello@sentry.io'));

    expect(screen.getByLabelText('Send Invites')).toBeEnabled();
    expect(screen.getByText('Invite 1 missing member')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select hello@sentry.io'));

    expect(screen.getByLabelText('Send Invites')).toBeDisabled();
    expect(screen.getByText('Invite missing members')).toBeInTheDocument();
  });

  it('can select and deselect all rows', async function () {
    render(<InviteMissingMembersModal {...modalProps} missingMembers={missingMembers} />);

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select All'));

    expect(screen.getByLabelText('Send Invites')).toBeEnabled();
    expect(screen.getByText('Invite all 5 missing members')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Deselect All'));

    expect(screen.getByLabelText('Send Invites')).toBeDisabled();
    expect(screen.getByText('Invite missing members')).toBeInTheDocument();
  });

  it('can invite all members', async function () {
    render(
      <InviteMissingMembersModal
        {...modalProps}
        organization={TestStubs.Organization({defaultRole: 'member'})}
        missingMembers={missingMembers}
        invitableRoles={roles}
      />
    );

    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
      body: {},
    });

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select All'));
    await userEvent.click(screen.getByLabelText('Send Invites'));

    // Verify data sent to the backend
    expect(createMemberMock).toHaveBeenCalledTimes(5);

    missingMembers.forEach((member, i) => {
      expect(createMemberMock).toHaveBeenNthCalledWith(
        i + 1,
        `/organizations/${org.slug}/members/`,
        expect.objectContaining({
          data: {email: member.email, role: 'member', teams: []},
        })
      );
    });
  });

  it('can invite multiple members', async function () {
    render(
      <InviteMissingMembersModal
        {...modalProps}
        organization={TestStubs.Organization({defaultRole: 'member', teams: [team]})}
        missingMembers={missingMembers}
        invitableRoles={roles}
      />
    );

    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
      body: {},
    });

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    const roleInputs = screen.getAllByRole('textbox', {name: 'Role'});
    const teamInputs = screen.getAllByRole('textbox', {name: 'Add to Team'});

    await userEvent.click(screen.getByLabelText('Select hello@sentry.io'));
    await selectEvent.select(roleInputs[0], 'Admin');

    await userEvent.click(screen.getByLabelText('Select abcd@sentry.io'));
    await selectEvent.select(teamInputs[1], '#team-slug');

    await userEvent.click(screen.getByLabelText('Send Invites'));

    // Verify data sent to the backend
    expect(createMemberMock).toHaveBeenCalledTimes(2);

    expect(createMemberMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: 'hello@sentry.io', role: 'admin', teams: []},
      })
    );

    expect(createMemberMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: 'abcd@sentry.io', role: 'member', teams: [team.slug]},
      })
    );
  });
});
