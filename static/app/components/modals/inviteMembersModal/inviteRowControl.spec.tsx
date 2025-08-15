import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  defaultInviteProps,
  InviteMembersContext,
  type InviteMembersContextValue,
} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteRowControlNew from 'sentry/components/modals/inviteMembersModal/inviteRowControl';
import TeamStore from 'sentry/stores/teamStore';
import type {DetailedTeam} from 'sentry/types/organization';

describe('InviteRowControlNew', () => {
  const teamData = [
    {
      id: '1',
      slug: 'moo-deng',
      name: "Moo Deng's Team",
      isMember: true,
    },
    {
      id: '2',
      slug: 'moo-waan',
      name: "Moo Waan's Team",
      isMember: false,
    },
  ];
  const teams: DetailedTeam[] = teamData.map(data => TeamFixture(data));

  const billingProps = {
    ...defaultInviteProps,
    isOverMemberLimit: true,
  };

  const getComponent = (props: InviteMembersContextValue) => (
    <InviteMembersContext value={props}>
      <InviteRowControlNew
        roleDisabledUnallowed={false}
        roleOptions={[
          {
            id: 'member',
            name: 'Member',
            desc: '...',
            minimumTeamRole: 'contributor',
            isTeamRolesAllowed: true,
          },
          {
            id: 'billing',
            name: 'Billing',
            desc: '...',
            minimumTeamRole: 'contributor',
            isTeamRolesAllowed: false,
          },
        ]}
      />
    </InviteMembersContext>
  );

  beforeEach(() => {
    TeamStore.loadInitialData(teams);
  });

  it('renders', () => {
    render(getComponent(defaultInviteProps));

    expect(screen.getByRole('textbox', {name: 'Email Addresses'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Role'})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: 'Add to Team'})).toBeInTheDocument();
  });

  it('renders with invite-billing flag', () => {
    render(getComponent(billingProps));

    expect(screen.getByRole('textbox', {name: 'Email Addresses'})).toBeInTheDocument();
    const roleInput = screen.getByRole('textbox', {name: 'Role'});
    expect(roleInput).toBeInTheDocument();
    expect(roleInput).toBeDisabled();
    const teamInput = screen.getByRole('textbox', {name: 'Add to Team'});
    expect(teamInput).toBeInTheDocument();
  });

  describe.each([
    {email: 'test-space@example.com', delimiter: ' '},
    {email: 'test-comma@example.com', delimiter: ','},
    {email: 'test-newline@example.com', delimiter: '{enter}'},
  ])('updates email addresses when new emails are inputted', ({email, delimiter}) => {
    it(`invokes the mock correctly with one using delimiter "${delimiter}"`, async () => {
      const mockSetEmails = jest.fn();
      render(getComponent({...defaultInviteProps, setEmails: mockSetEmails}));
      const emailInput = screen.getByRole('textbox', {name: 'Email Addresses'});
      await userEvent.type(emailInput, `${email}${delimiter}`);
      expect(mockSetEmails).toHaveBeenCalled();
    });

    it(`invokes the mock correctly with many using delimiter "${delimiter}"`, async () => {
      const mockSetEmails = jest.fn();
      render(getComponent({...defaultInviteProps, setEmails: mockSetEmails}));
      const emailInput = screen.getByRole('textbox', {name: 'Email Addresses'});
      await userEvent.type(emailInput, `${email}${delimiter}`);
      await userEvent.type(emailInput, `${email}${delimiter}`);
      await userEvent.type(emailInput, `${email}${delimiter}`);
      expect(mockSetEmails).toHaveBeenCalledTimes(3);
    });
  });

  it('updates email addresses when new emails are inputted and input is unfocussed', async () => {
    const mockSetEmails = jest.fn();
    render(getComponent({...defaultInviteProps, setEmails: mockSetEmails}));
    const emailInput = screen.getByRole('textbox', {name: 'Email Addresses'});
    await userEvent.type(emailInput, 'test-unfocus@example.com');
    await userEvent.tab();
    expect(mockSetEmails).toHaveBeenCalled();
  });

  it('updates role value when new role is selected', async () => {
    const mockSetRole = jest.fn();
    render(getComponent({...defaultInviteProps, setRole: mockSetRole}));
    const roleInput = screen.getByRole('textbox', {name: 'Role'});
    await userEvent.click(roleInput);
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Billing'}));
    expect(mockSetRole).toHaveBeenCalled();
  });

  it('disables team selection when team roles are not allowed', () => {
    render(
      getComponent({
        ...defaultInviteProps,
        pendingInvites: {
          ...defaultInviteProps.pendingInvites,
          role: 'billing',
        },
      })
    );
    const teamInput = screen.getByRole('textbox', {name: 'Add to Team'});
    expect(teamInput).toBeDisabled();
  });

  it('enables team selection when team roles are allowed', async () => {
    const mockSetTeams = jest.fn();
    render(
      getComponent({
        ...defaultInviteProps,
        pendingInvites: {
          ...defaultInviteProps.pendingInvites,
          role: 'member',
        },
        setTeams: mockSetTeams,
      })
    );
    const teamInput = screen.getByRole('textbox', {name: 'Add to Team'});
    expect(teamInput).toBeEnabled();
    await userEvent.click(teamInput);
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: '#moo-deng'}));
    await userEvent.click(screen.getByRole('menuitemcheckbox', {name: '#moo-waan'}));
    expect(mockSetTeams).toHaveBeenCalledTimes(2);
  });

  it('shows all teams if Open Membership is enabled', async () => {
    const {organization: orgWithInviteAccess} = initializeOrg({
      organization: {
        access: ['member:invite'],
        allowMemberInvite: true,
        openMembership: true,
      },
    });
    render(getComponent(defaultInviteProps), {organization: orgWithInviteAccess});
    const teamInput = screen.getByRole('textbox', {name: 'Add to Team'});
    expect(teamInput).toBeEnabled();
    await userEvent.click(teamInput);
    expect(screen.getByText('#moo-deng')).toBeInTheDocument();
    expect(screen.getByText('#moo-waan')).toBeInTheDocument();
  });

  it('only shows member teams if Open Membership is disabled', async () => {
    const {organization: orgWithInviteAccess} = initializeOrg({
      organization: {
        access: ['member:invite'],
        allowMemberInvite: true,
        openMembership: false,
      },
    });
    render(getComponent(defaultInviteProps), {organization: orgWithInviteAccess});
    const teamInput = screen.getByRole('textbox', {name: 'Add to Team'});
    expect(teamInput).toBeEnabled();
    await userEvent.click(teamInput);
    expect(screen.getByText('#moo-deng')).toBeInTheDocument();
    expect(screen.queryByText('#moo-waan')).not.toBeInTheDocument();
  });
});
