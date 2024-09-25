import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {InviteMembersContext} from 'sentry/components/modals/inviteMembersModal/inviteMembersContext';
import InviteRowControlNew from 'sentry/components/modals/inviteMembersModal/inviteRowControlNew';
import TeamStore from 'sentry/stores/teamStore';

describe('InviteRowControlNew', function () {
  const mockOnChangeEmails = jest.fn();
  const mockOnChangeRole = jest.fn();
  const mockOnChangeTeams = jest.fn();

  const teamData = [
    {
      id: '1',
      slug: 'moo-deng',
      name: "Moo Deng's Team",
    },
    {
      id: '2',
      slug: 'moo-waan',
      name: "Moo Waan's Team",
    },
  ];
  const teams = teamData.map(data => TeamFixture(data));

  const getComponent = (role?: string) => (
    <InviteMembersContext.Provider
      value={{
        complete: false,
        inviteStatus: {},
        invites: [],
        pendingInvites: [
          {
            emails: new Set<string>(),
            teams: new Set<string>(),
            role: role || '',
          },
        ],
        reset: () => {},
        sendInvites: () => {},
        sendingInvites: false,
        setEmails: mockOnChangeEmails,
        setRole: mockOnChangeRole,
        setTeams: mockOnChangeTeams,
        willInvite: true,
      }}
    >
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
    </InviteMembersContext.Provider>
  );

  beforeEach(function () {
    TeamStore.loadInitialData(teams);
  });

  it('renders', function () {
    render(getComponent());

    expect(screen.getByText('Email addresses')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Add to team')).toBeInTheDocument();
  });

  describe.each([
    {email: 'test-space@example.com', delimiter: ' '},
    {email: 'test-comma@example.com', delimiter: ','},
    {email: 'test-newline@example.com', delimiter: '{enter}'},
  ])('updates email addresses when new emails are inputted', ({email, delimiter}) => {
    it(`invokes the mock correctly with one using delimiter "${delimiter}"`, async () => {
      render(getComponent());
      const emailInput = screen.getByLabelText('Email Addresses');
      await userEvent.type(emailInput, `${email}${delimiter}`);
      expect(mockOnChangeEmails).toHaveBeenCalled();
    });

    it(`invokes the mock correctly with many using delimiter "${delimiter}"`, async () => {
      render(getComponent());
      const emailInput = screen.getByLabelText('Email Addresses');
      await userEvent.type(emailInput, `${email}${delimiter}`);
      await userEvent.type(emailInput, `${email}${delimiter}`);
      await userEvent.type(emailInput, `${email}${delimiter}`);
      expect(mockOnChangeEmails).toHaveBeenCalledTimes(3);
    });
  });

  it('updates email addresses when new emails are inputted and input is unfocussed', async function () {
    render(getComponent());
    const emailInput = screen.getByLabelText('Email Addresses');
    await userEvent.type(emailInput, 'test-unfocus@example.com');
    await userEvent.tab();
    expect(mockOnChangeEmails).toHaveBeenCalled();
  });

  it('updates role value when new role is selected', async function () {
    render(getComponent());
    const roleInput = screen.getByLabelText('Role');
    await userEvent.click(roleInput);
    await userEvent.click(screen.getByText('Billing'));
    expect(mockOnChangeRole).toHaveBeenCalled();
  });

  it('disables team selection when team roles are not allowed', function () {
    render(getComponent('billing'));
    const teamInput = screen.getByLabelText('Add to Team');
    expect(teamInput).toBeDisabled();
  });

  it('enables team selection when team roles are allowed', async function () {
    render(getComponent('member'));
    const teamInput = screen.getByLabelText('Add to Team');
    expect(teamInput).toBeEnabled();
    await userEvent.click(teamInput);
    await userEvent.click(screen.getByText('#moo-deng'));
    await userEvent.click(screen.getByText('#moo-waan'));
    expect(mockOnChangeTeams).toHaveBeenCalledTimes(2);
  });
});
