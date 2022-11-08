import selectEvent from 'react-select-event';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import InviteMembersModal from 'sentry/components/modals/inviteMembersModal';
import TeamStore from 'sentry/stores/teamStore';

describe('InviteMembersModal', function () {
  const team = TestStubs.Team();
  const org = TestStubs.Organization({access: ['member:write'], teams: [team]});
  TeamStore.loadInitialData([team]);

  const modalProps = {
    Body: p => p.children,
    Header: p => p.children,
    Footer: p => p.children,
  };

  const noWriteOrg = TestStubs.Organization({
    access: [],
  });

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
  ];

  MockApiClient.addMockResponse({
    url: `/organizations/${org.slug}/members/me/`,
    method: 'GET',
    body: {roles},
  });

  it('renders', function () {
    render(<InviteMembersModal {...modalProps} organization={org} />);

    // Starts with one invite row
    expect(screen.getByRole('listitem')).toBeInTheDocument();

    // We have two roles loaded from the members/me endpoint, defaulting to the
    // 'member' role.
    userEvent.click(screen.getByRole('textbox', {name: 'Role'}));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(roles.length);
    expect(screen.getByRole('menuitemradio', {name: 'Member'})).toBeChecked();
  });

  it('renders without organization.access', function () {
    const organization = TestStubs.Organization({access: undefined});
    render(<InviteMembersModal {...modalProps} organization={organization} />);

    expect(screen.getByRole('listitem')).toBeInTheDocument();
  });

  it('can add a second row', function () {
    render(<InviteMembersModal {...modalProps} organization={org} />);

    expect(screen.getByRole('listitem')).toBeInTheDocument();
    userEvent.click(screen.getByRole('button', {name: 'Add another'}));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('errors on duplicate emails', function () {
    render(<InviteMembersModal {...modalProps} organization={org} />);

    userEvent.click(screen.getByRole('button', {name: 'Add another'}));

    const emailInputs = screen.getAllByRole('textbox', {name: 'Email Addresses'});

    userEvent.type(emailInputs[0], 'test@test.com');
    userEvent.tab();

    userEvent.type(emailInputs[1], 'test@test.com');
    userEvent.tab();

    expect(screen.getByText('Duplicate emails between invite rows.')).toBeInTheDocument();
  });

  it('indicates the total invites on the invite button', function () {
    render(<InviteMembersModal {...modalProps} organization={org} />);

    const emailInput = screen.getByRole('textbox', {name: 'Email Addresses'});

    userEvent.type(emailInput, 'test@test.com');
    userEvent.tab();

    userEvent.type(emailInput, 'test2@test.com');
    userEvent.tab();

    expect(screen.getByRole('button', {name: 'Send invites (2)'})).toBeInTheDocument();
  });

  it('can be closed', function () {
    const close = jest.fn();

    render(<InviteMembersModal {...modalProps} organization={org} closeModal={close} />);

    userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(close).toHaveBeenCalled();
  });

  it('sends all successful invites', async function () {
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    render(<InviteMembersModal {...modalProps} organization={org} />);

    // Setup two rows, one email each, the first with a admin role.
    userEvent.click(screen.getByRole('button', {name: 'Add another'}));

    const emailInputs = screen.getAllByRole('textbox', {name: 'Email Addresses'});
    const roleInputs = screen.getAllByRole('textbox', {name: 'Role'});
    const teamInputs = screen.getAllByRole('textbox', {name: 'Add to Team'});

    userEvent.type(emailInputs[0], 'test1@test.com');
    userEvent.tab();
    await selectEvent.select(roleInputs[0], 'Admin');
    await selectEvent.select(teamInputs[0], '#team-slug');

    userEvent.type(emailInputs[1], 'test2@test.com');
    userEvent.tab();

    userEvent.click(screen.getByRole('button', {name: 'Send invites (2)'}));

    // Verify data sent to the backend
    expect(createMemberMock).toHaveBeenCalledTimes(2);

    expect(createMemberMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: 'test1@test.com', role: 'admin', teams: ['team-slug']},
      })
    );
    expect(createMemberMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: 'test2@test.com', role: 'member', teams: []},
      })
    );

    // Pending invites being created...

    // three loading indicators (one for each email + a global "sending")
    expect(screen.getAllByTestId('loading-indicator')).toHaveLength(3);

    expect(
      screen.getByText('Sending organization invitations\u2026')
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Send invites (2)'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeDisabled();

    // Wait for them to finish
    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 2 invites'))
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Close'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Send more invites'})).toBeInTheDocument();

    // Send more reset the modal
    userEvent.click(screen.getByRole('button', {name: 'Send more invites'}));

    expect(screen.getByRole('button', {name: 'Send invite'})).toBeDisabled();
  });

  it('marks failed invites', async function () {
    const faildCreateMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
      statusCode: 400,
    });

    render(<InviteMembersModal {...modalProps} organization={org} />);

    userEvent.type(screen.getByRole('textbox', {name: 'Email Addresses'}), 'bademail');
    userEvent.tab();
    userEvent.click(screen.getByRole('button', {name: 'Send invite'}));

    expect(faildCreateMemberMock).toHaveBeenCalled();

    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 0 invites, 1 failed to send.'))
    ).toBeInTheDocument();
  });

  it('can send initial email', async function () {
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    const initialEmail = 'test@gmail.com';
    const initialData = [{emails: new Set([initialEmail])}];

    render(
      <InviteMembersModal {...modalProps} organization={org} initialData={initialData} />
    );

    expect(screen.getByText(initialEmail)).toBeInTheDocument();

    // Just immediately click send
    userEvent.click(screen.getByRole('button', {name: 'Send invite'}));

    expect(createMemberMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: initialEmail, role: 'member', teams: []},
      })
    );

    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 1 invite'))
    ).toBeInTheDocument();
  });

  it('can send initial email with role and team', async function () {
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    const initialEmail = 'test@gmail.com';
    const role = 'admin';
    const initialData = [
      {emails: new Set([initialEmail]), role, teams: new Set([team.slug])},
    ];

    render(
      <InviteMembersModal {...modalProps} organization={org} initialData={initialData} />
    );

    // Just immediately click send
    userEvent.click(screen.getByRole('button', {name: 'Send invite'}));

    expect(screen.getByText(initialEmail)).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();

    expect(createMemberMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: initialEmail, role, teams: [team.slug]},
      })
    );

    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 1 invite'))
    ).toBeInTheDocument();
  });

  describe('member invite request mode', function () {
    it('has adjusted wording', function () {
      render(<InviteMembersModal {...modalProps} organization={noWriteOrg} />);

      expect(
        screen.getByRole('button', {name: 'Send invite request'})
      ).toBeInTheDocument();

      expect(screen.getByTestId('more-information')).toBeInTheDocument();
    });

    it('POSTS to the invite-request endpoint', function () {
      const createInviteRequestMock = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/invite-requests/`,
        method: 'POST',
      });

      // Use initial data so we don't have to setup as much stuff
      const initialEmail = 'test@gmail.com';
      const initialData = [{emails: new Set(['test@gmail.com'])}];

      render(
        <InviteMembersModal
          {...modalProps}
          organization={noWriteOrg}
          initialData={initialData}
        />
      );

      expect(screen.getByText(initialEmail)).toBeInTheDocument();

      userEvent.click(screen.getByRole('button', {name: 'Send invite request'}));

      expect(createInviteRequestMock).toHaveBeenCalledTimes(1);
    });
  });
});
