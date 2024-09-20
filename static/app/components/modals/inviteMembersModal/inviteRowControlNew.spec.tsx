import type {ComponentProps} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import InviteRowControlNew from 'sentry/components/modals/inviteMembersModal/inviteRowControlNew';

describe('InviteRowControlNew', function () {
  const mockOnChangeEmails = jest.fn();
  const mockOnChangeRole = jest.fn();
  const mockOnChangeTeams = jest.fn();
  const rowControlProps: ComponentProps<typeof InviteRowControlNew> = {
    disabled: false,
    emails: [],
    inviteStatus: {},
    onChangeEmails: mockOnChangeEmails,
    onChangeRole: mockOnChangeRole,
    onChangeTeams: mockOnChangeTeams,
    onRemove: () => {},
    role: '',
    roleDisabledUnallowed: false,
    roleOptions: [
      {
        id: 'moo-deng',
        name: 'Moo Deng',
        desc: '...',
        minimumTeamRole: 'contributor',
        isTeamRolesAllowed: true,
      },
      {
        id: 'moo-waan',
        name: 'Moo Waan',
        desc: '...',
        minimumTeamRole: 'contributor',
        isTeamRolesAllowed: false,
      },
    ],
    teams: ['Zoo'],
  };

  it('renders', function () {
    render(<InviteRowControlNew {...rowControlProps} />);

    expect(screen.getByText('Email addresses')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Add to team')).toBeInTheDocument();
  });

  it('updates email addresses when new emails are inputted', async function () {
    render(<InviteRowControlNew {...rowControlProps} />);
    const emailInput = screen.getByLabelText('Email Addresses');
    await userEvent.type(emailInput, 'test-space@example.com ');
    await userEvent.type(emailInput, 'test-comma@example.com,');
    await userEvent.type(emailInput, 'test-newline@example.com{enter}');
    await userEvent.type(emailInput, 'test-unfocus@example.com');
    await userEvent.tab();
    expect(mockOnChangeEmails).toHaveBeenCalledTimes(4);
  });

  it('updates role value when new role is selected', async function () {
    render(<InviteRowControlNew {...rowControlProps} />);
    const roleInput = screen.getByLabelText('Role');
    await userEvent.click(roleInput);
    await userEvent.click(screen.getByText('Moo Deng'));
    expect(mockOnChangeRole).toHaveBeenCalled();
  });

  it('disables team selection when team roles are not allowed', function () {
    render(<InviteRowControlNew {...rowControlProps} role="moo-waan" />);
    const teamInput = screen.getByLabelText('Add to Team');
    expect(teamInput).toBeDisabled();
  });

  it('enables team selection when team roles are allowed', async function () {
    render(<InviteRowControlNew {...rowControlProps} role="moo-deng" />);
    const teamInput = screen.getByLabelText('Add to Team');
    expect(teamInput).toBeEnabled();
    await userEvent.click(teamInput);
  });
});
