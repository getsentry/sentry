import styled from '@emotion/styled';
import {MissingMembersFixture} from 'sentry-fixture/missingMembers';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import type {InviteMissingMembersModalProps} from 'sentry/components/modals/inviteMissingMembersModal';
import InviteMissingMembersModal from 'sentry/components/modals/inviteMissingMembersModal';
import TeamStore from 'sentry/stores/teamStore';
import type {OrgRole} from 'sentry/types/organization';

const roles = [
  {
    id: 'admin',
    name: 'Admin',
    desc: 'This is the admin role',
    isAllowed: true,
  },
  {
    id: 'member',
    name: 'Member',
    desc: 'This is the member role',
    isAllowed: true,
  },
] as OrgRole[];

const mockRefObject = {
  current: document.body as HTMLDivElement,
};

describe('InviteMissingMembersModal', function () {
  const team = TeamFixture();
  const org = OrganizationFixture({access: ['member:write']});
  TeamStore.loadInitialData([team]);
  const missingMembers = MissingMembersFixture();

  const styledWrapper = styled(c => c.children);
  const modalProps: InviteMissingMembersModalProps = {
    Body: styledWrapper(),
    Header: p => <span>{p.children}</span>,
    Footer: styledWrapper(),
    closeModal: () => {},
    CloseButton: makeCloseButton(() => {}),
    organization: OrganizationFixture(),
    missingMembers: [],
    allowedRoles: [],
    modalContainerRef: mockRefObject,
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/me/`,
      method: 'GET',
      body: {roles},
    });
  });

  it('does not render if no missing members', function () {
    render(<InviteMissingMembersModal {...modalProps} />);

    expect(
      screen.queryByRole('heading', {name: 'Invite Your Dev Team'})
    ).not.toBeInTheDocument();
  });

  it('does not render without org:write', function () {
    const organization = OrganizationFixture({access: []});
    render(<InviteMissingMembersModal {...modalProps} organization={organization} />);

    expect(
      screen.queryByRole('heading', {name: 'Invite Your Dev Team'})
    ).not.toBeInTheDocument();
  });

  it('disables invite button if no members selected', async function () {
    render(<InviteMissingMembersModal {...modalProps} missingMembers={missingMembers} />);

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Deselect All'));

    expect(screen.getByLabelText('Send Invites')).toBeDisabled();
    expect(screen.getByText('Invite missing members')).toBeInTheDocument();
  });

  it('enables and disables invite button when toggling one checkbox', async function () {
    render(<InviteMissingMembersModal {...modalProps} missingMembers={missingMembers} />);

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Deselect All'));
    await userEvent.click(screen.getByLabelText('Select hello@sentry.io'));

    expect(screen.getByLabelText('Send Invites')).toBeEnabled();
    expect(screen.getByText('Invite 1 missing member')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select hello@sentry.io'));

    expect(screen.getByLabelText('Send Invites')).toBeDisabled();
    expect(screen.getByText('Invite missing members')).toBeInTheDocument();
  });

  it('can deselect and select all rows', async function () {
    render(<InviteMissingMembersModal {...modalProps} missingMembers={missingMembers} />);

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Deselect All'));

    expect(screen.getByLabelText('Send Invites')).toBeDisabled();
    expect(screen.getByText('Invite missing members')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select All'));

    expect(screen.getByLabelText('Send Invites')).toBeEnabled();
    expect(screen.getByText('Invite all 5 missing members')).toBeInTheDocument();
  });

  it('can invite all members', async function () {
    render(
      <InviteMissingMembersModal
        {...modalProps}
        organization={OrganizationFixture({defaultRole: 'member'})}
        missingMembers={missingMembers}
        allowedRoles={roles}
      />
    );

    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/?referrer=github_nudge_invite`,
      method: 'POST',
      body: {},
    });

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Send Invites'));

    // Verify data sent to the backend
    expect(createMemberMock).toHaveBeenCalledTimes(5);

    missingMembers.forEach((member, i) => {
      expect(createMemberMock).toHaveBeenNthCalledWith(
        i + 1,
        `/organizations/${org.slug}/members/?referrer=github_nudge_invite`,
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
        organization={OrganizationFixture({defaultRole: 'member'})}
        missingMembers={missingMembers}
        allowedRoles={roles}
      />
    );

    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/?referrer=github_nudge_invite`,
      method: 'POST',
      body: {},
    });

    expect(
      screen.getByRole('heading', {name: 'Invite Your Dev Team'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Deselect All'));

    const roleInputs = screen.getAllByRole('textbox', {name: 'Role'});
    const teamInputs = screen.getAllByRole('textbox', {name: 'Add to Team'});

    await userEvent.click(screen.getByLabelText('Select hello@sentry.io'));
    await selectEvent.select(roleInputs[0]!, 'Admin', {
      container: document.body,
    });

    await userEvent.click(screen.getByLabelText('Select abcd@sentry.io'));
    await selectEvent.select(teamInputs[1]!, '#team-slug', {
      container: document.body,
    });

    await userEvent.click(screen.getByLabelText('Send Invites'));

    // Verify data sent to the backend
    expect(createMemberMock).toHaveBeenCalledTimes(2);

    expect(createMemberMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${org.slug}/members/?referrer=github_nudge_invite`,
      expect.objectContaining({
        data: {email: 'hello@sentry.io', role: 'admin', teams: []},
      })
    );

    expect(createMemberMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${org.slug}/members/?referrer=github_nudge_invite`,
      expect.objectContaining({
        data: {email: 'abcd@sentry.io', role: 'member', teams: [team.slug]},
      })
    );
  });
});
