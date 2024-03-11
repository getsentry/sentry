import type {ComponentProps} from 'react';
import styled from '@emotion/styled';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import InviteMembersModal from 'sentry/components/modals/inviteMembersModal';
import {ORG_ROLES} from 'sentry/constants';
import TeamStore from 'sentry/stores/teamStore';
import useOrganization from 'sentry/utils/useOrganization';

jest.mock('sentry/utils/useOrganization');

describe('InviteMembersModal', function () {
  const team = TeamFixture();
  const org = OrganizationFixture({access: ['member:write'], teams: [team]});
  TeamStore.loadInitialData([team]);

  const styledWrapper = styled(c => c.children);
  const modalProps: ComponentProps<typeof InviteMembersModal> = {
    Body: styledWrapper(),
    Header: p => <span>{p.children}</span>,
    Footer: styledWrapper(),
    closeModal: () => {},
    CloseButton: makeCloseButton(() => {}),
  };

  const noWriteOrg = OrganizationFixture({
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

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/me/`,
      method: 'GET',
      body: {roles},
    });
  });

  it('renders', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    render(<InviteMembersModal {...modalProps} />);

    await waitFor(() => {
      // Starts with one invite row
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });

    // We have two roles loaded from the members/me endpoint, defaulting to the
    // 'member' role.
    await userEvent.click(screen.getByRole('textbox', {name: 'Role'}));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(roles.length);
    expect(screen.getByRole('menuitemradio', {name: 'Member'})).toBeChecked();
  });

  it('renders for superuser', async function () {
    jest.mock('sentry/utils/isActiveSuperuser', () => ({
      isActiveSuperuser: jest.fn(),
    }));

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/me/`,
      method: 'GET',
      status: 404,
    });

    jest.mocked(useOrganization).mockReturnValue(org);
    render(<InviteMembersModal {...modalProps} />);

    await waitFor(() => {
      // Starts with one invite row
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('textbox', {name: 'Role'}));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(ORG_ROLES.length);
    expect(screen.getByRole('menuitemradio', {name: 'Member'})).toBeChecked();
  });

  it('renders without organization.access', async function () {
    const organization = OrganizationFixture({access: undefined});
    jest.mocked(useOrganization).mockReturnValue(organization);
    render(<InviteMembersModal {...modalProps} />);

    await waitFor(() => {
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });
  });

  it('can add a second row', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    render(<InviteMembersModal {...modalProps} />);

    await waitFor(() => {
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', {name: 'Add another'}));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('errors on duplicate emails', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    render(<InviteMembersModal {...modalProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Add another'})).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', {name: 'Add another'}));

    const emailInputs = screen.getAllByRole('textbox', {name: 'Email Addresses'});

    await userEvent.type(emailInputs[0], 'test@test.com');
    await userEvent.tab();

    await userEvent.type(emailInputs[1], 'test@test.com');
    await userEvent.tab();

    expect(screen.getByText('Duplicate emails between invite rows.')).toBeInTheDocument();
  });

  it('indicates the total invites on the invite button', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    render(<InviteMembersModal {...modalProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Email Addresses'})).toBeInTheDocument();
    });

    const emailInput = screen.getByRole('textbox', {name: 'Email Addresses'});

    await userEvent.type(emailInput, 'test@test.com');
    await userEvent.tab();

    await userEvent.type(emailInput, 'test2@test.com');
    await userEvent.tab();

    expect(screen.getByRole('button', {name: 'Send invites (2)'})).toBeInTheDocument();
  });

  it('can be closed', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    const close = jest.fn();

    render(<InviteMembersModal {...modalProps} closeModal={close} />);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(close).toHaveBeenCalled();
  });

  it('sends all successful invites, and removes team defaults', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    render(<InviteMembersModal {...modalProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Add another'})).toBeInTheDocument();
    });

    // Setup two rows, one email each, the first with a admin role.
    await userEvent.click(screen.getByRole('button', {name: 'Add another'}));

    const emailInputs = screen.getAllByRole('textbox', {name: 'Email Addresses'});
    const roleInputs = screen.getAllByRole('textbox', {name: 'Role'});
    const teamInputs = screen.getAllByRole('textbox', {name: 'Add to Team'});

    await userEvent.type(emailInputs[0], 'test1@test.com');
    await userEvent.tab();
    await selectEvent.select(roleInputs[0], 'Admin');
    await selectEvent.select(teamInputs[0], '#team-slug');

    await userEvent.type(emailInputs[1], 'test2@test.com');
    await selectEvent.select(teamInputs[1], '#team-slug');
    await userEvent.tab();

    await userEvent.click(screen.getByRole('button', {name: 'Send invites (2)'}));

    // Verify data sent to the backend
    expect(createMemberMock).toHaveBeenCalledTimes(2);

    expect(createMemberMock).toHaveBeenNthCalledWith(
      1,
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: 'test1@test.com', role: 'admin', teams: []},
      })
    );
    expect(createMemberMock).toHaveBeenNthCalledWith(
      2,
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: 'test2@test.com', role: 'member', teams: []},
      })
    );

    // Wait for them to finish
    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 2 invites'))
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Close'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Send more invites'})).toBeInTheDocument();

    // Send more reset the modal
    await userEvent.click(screen.getByRole('button', {name: 'Send more invites'}));

    expect(screen.getByRole('button', {name: 'Send invite'})).toBeDisabled();
  });

  it('sends all successful invites with team default', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    render(<InviteMembersModal {...modalProps} />);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Add another'})).toBeInTheDocument();
    });

    // Setup two rows, one email each, the first with a admin role.
    await userEvent.click(screen.getByRole('button', {name: 'Add another'}));

    const emailInputs = screen.getAllByRole('textbox', {name: 'Email Addresses'});
    const roleInputs = screen.getAllByRole('textbox', {name: 'Role'});

    await userEvent.type(emailInputs[0], 'test1@test.com');
    await userEvent.tab();
    await selectEvent.select(roleInputs[0], 'Admin');

    await userEvent.type(emailInputs[1], 'test2@test.com');
    await userEvent.tab();

    await userEvent.click(screen.getByRole('button', {name: 'Send invites (2)'}));

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
        data: {email: 'test2@test.com', role: 'member', teams: ['team-slug']},
      })
    );

    // Wait for them to finish
    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 2 invites'))
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Close'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Send more invites'})).toBeInTheDocument();

    // Send more reset the modal
    await userEvent.click(screen.getByRole('button', {name: 'Send more invites'}));

    expect(screen.getByRole('button', {name: 'Send invite'})).toBeDisabled();
  });

  it('marks failed invites', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    const faildCreateMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
      statusCode: 400,
    });

    render(<InviteMembersModal {...modalProps} />);

    await waitFor(() => {
      expect(screen.getByRole('textbox', {name: 'Email Addresses'})).toBeInTheDocument();
    });

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email Addresses'}),
      'bademail'
    );
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', {name: 'Send invite'}));

    expect(faildCreateMemberMock).toHaveBeenCalled();

    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 0 invites, 1 failed to send.'))
    ).toBeInTheDocument();
  });

  it('can send initial email', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    const initialEmail = 'test@gmail.com';
    const initialData = [{emails: new Set([initialEmail])}];

    render(<InviteMembersModal {...modalProps} initialData={initialData} />);

    await waitFor(() => {
      expect(screen.getByText(initialEmail)).toBeInTheDocument();
    });

    // Just immediately click send
    await userEvent.click(screen.getByRole('button', {name: 'Send invite'}));

    expect(createMemberMock).toHaveBeenCalledWith(
      `/organizations/${org.slug}/members/`,
      expect.objectContaining({
        data: {email: initialEmail, role: 'member', teams: ['team-slug']},
      })
    );

    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 1 invite'))
    ).toBeInTheDocument();
  });

  it('can send initial email with role and team', async function () {
    jest.mocked(useOrganization).mockReturnValue(org);
    const createMemberMock = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/members/`,
      method: 'POST',
    });

    const initialEmail = 'test@gmail.com';
    const role = 'admin';
    const initialData = [
      {emails: new Set([initialEmail]), role, teams: new Set([team.slug])},
    ];

    render(<InviteMembersModal {...modalProps} initialData={initialData} />);

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Send invite'})).toBeInTheDocument();
    });
    // Just immediately click send
    await userEvent.click(screen.getByRole('button', {name: 'Send invite'}));

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
    it('has adjusted wording', async function () {
      jest.mocked(useOrganization).mockReturnValue(noWriteOrg);
      render(<InviteMembersModal {...modalProps} />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', {name: 'Send invite request'})
        ).toBeInTheDocument();
      });
    });

    it('POSTS to the invite-request endpoint', async function () {
      jest.mocked(useOrganization).mockReturnValue(noWriteOrg);
      const createInviteRequestMock = MockApiClient.addMockResponse({
        url: `/organizations/${org.slug}/invite-requests/`,
        method: 'POST',
      });

      // Use initial data so we don't have to setup as much stuff
      const initialEmail = 'test@gmail.com';
      const initialData = [{emails: new Set(['test@gmail.com'])}];

      render(<InviteMembersModal {...modalProps} initialData={initialData} />);

      await waitFor(() => {
        expect(screen.getByText(initialEmail)).toBeInTheDocument();
      });

      await userEvent.click(screen.getByRole('button', {name: 'Send invite request'}));

      expect(createInviteRequestMock).toHaveBeenCalledTimes(1);
    });
  });
});
