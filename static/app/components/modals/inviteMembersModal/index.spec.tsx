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
import type {DetailedTeam, Scope} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

jest.mock('sentry/utils/useOrganization');

describe('InviteMembersModal', function () {
  const styledWrapper = styled(c => c.children);

  type MockApiResponseFn = (
    client: typeof MockApiClient,
    orgSlug: string,
    roles?: object[]
  ) => jest.Mock;
  const defaultMockOrganizationRoles: MockApiResponseFn = (client, orgSlug, roles) => {
    return client.addMockResponse({
      url: `/organizations/${orgSlug}/members/me/`,
      method: 'GET',
      body: {roles},
    });
  };

  const defaultMockPostOrganizationMember: MockApiResponseFn = (client, orgSlug, _) => {
    return client.addMockResponse({
      url: `/organizations/${orgSlug}/members/`,
      method: 'POST',
    });
  };

  const defaultMockModalProps = {
    Body: styledWrapper(),
    Header: p => <span>{p.children}</span>,
    Footer: styledWrapper(),
    closeModal: () => {},
    CloseButton: makeCloseButton(() => {}),
  };

  const setupView = ({
    orgTeams = [TeamFixture()],
    orgAccess = ['member:write'],
    roles = [
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
    ],
    modalProps = defaultMockModalProps,
    mockApiResponses = [defaultMockOrganizationRoles],
  }: {
    mockApiResponses?: MockApiResponseFn[];
    modalProps?: ComponentProps<typeof InviteMembersModal>;
    orgAccess?: Scope[];
    orgTeams?: DetailedTeam[];
    roles?: object[];
  } = {}) => {
    const org = OrganizationFixture({access: orgAccess, teams: orgTeams});
    TeamStore.reset();
    TeamStore.loadInitialData(orgTeams);

    MockApiClient.clearMockResponses();
    const mocks: jest.Mock[] = [];
    mockApiResponses.forEach(mockApiResponse => {
      mocks.push(mockApiResponse(MockApiClient, org.slug, roles));
    });
    jest.mocked(useOrganization).mockReturnValue(org);

    return {...render(<InviteMembersModal {...modalProps} />), mocks};
  };

  const setupMemberInviteState = async () => {
    // Setup two rows, one email each, the first with a admin role.
    await userEvent.click(screen.getByRole('button', {name: 'Add another'}));

    const emailInputs = screen.getAllByRole('textbox', {name: 'Email Addresses'});
    const roleInputs = screen.getAllByRole('textbox', {name: 'Role'});

    await userEvent.type(emailInputs[0], 'test1@test.com');
    await userEvent.tab();

    await selectEvent.select(roleInputs[0], 'Admin');

    await userEvent.type(emailInputs[1], 'test2@test.com');
    await userEvent.tab();
  };

  it('renders', async function () {
    setupView();
    await waitFor(() => {
      // Starts with one invite row
      expect(screen.getByRole('listitem')).toBeInTheDocument();
    });

    // We have two roles loaded from the members/me endpoint, defaulting to the
    // 'member' role.
    await userEvent.click(screen.getByRole('textbox', {name: 'Role'}));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
    expect(screen.getByRole('menuitemradio', {name: 'Member'})).toBeChecked();
  });

  it('renders for superuser', async function () {
    jest.mock('sentry/utils/isActiveSuperuser', () => ({
      isActiveSuperuser: jest.fn(),
    }));

    const errorResponse: MockApiResponseFn = (client, orgSlug, _) => {
      return client.addMockResponse({
        url: `/organizations/${orgSlug}/members/me/`,
        method: 'GET',
        status: 404,
      });
    };

    setupView({mockApiResponses: [errorResponse]});

    expect(await screen.findByRole('listitem')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('textbox', {name: 'Role'}));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(ORG_ROLES.length);
    expect(screen.getByRole('menuitemradio', {name: 'Member'})).toBeChecked();
  });

  it('renders without organization.access', async function () {
    setupView({orgAccess: undefined});

    expect(await screen.findByRole('listitem')).toBeInTheDocument();
  });

  it('can add a second row', async function () {
    setupView();

    expect(await screen.findByRole('listitem')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Add another'}));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('errors on duplicate emails', async function () {
    setupView();

    expect(await screen.findByRole('button', {name: 'Add another'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Add another'}));

    const emailInputs = screen.getAllByRole('textbox', {name: 'Email Addresses'});
    await userEvent.type(emailInputs[0], 'test@test.com');
    await userEvent.tab();

    await userEvent.type(emailInputs[1], 'test@test.com');
    await userEvent.tab();

    expect(screen.getByText('Duplicate emails between invite rows.')).toBeInTheDocument();
  });

  it('indicates the total invites on the invite button', async function () {
    setupView();

    expect(
      await screen.findByRole('textbox', {name: 'Email Addresses'})
    ).toBeInTheDocument();

    const emailInput = screen.getByRole('textbox', {name: 'Email Addresses'});
    await userEvent.type(emailInput, 'test@test.com');
    await userEvent.tab();

    await userEvent.type(emailInput, 'test2@test.com');
    await userEvent.tab();

    expect(screen.getByRole('button', {name: 'Send invites (2)'})).toBeInTheDocument();
  });

  it('can be closed', async function () {
    const close = jest.fn();
    const modalProps = {
      ...defaultMockModalProps,
      closeModal: close,
    };
    setupView({modalProps});

    expect(await screen.findByRole('button', {name: 'Cancel'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(close).toHaveBeenCalled();
  });

  it('sends all successful invites without team defaults', async function () {
    const {mocks} = setupView({
      mockApiResponses: [defaultMockOrganizationRoles, defaultMockPostOrganizationMember],
    });

    expect(await screen.findByRole('button', {name: 'Add another'})).toBeInTheDocument();
    await setupMemberInviteState();

    const teamInputs = screen.getAllByRole('textbox', {name: 'Add to Team'});
    await selectEvent.select(teamInputs[0], '#team-slug');
    await selectEvent.select(teamInputs[1], '#team-slug');

    await userEvent.click(screen.getByRole('button', {name: 'Send invites (2)'}));

    // Verify data sent to the backend
    const mockPostApi = mocks[1];
    expect(mockPostApi).toHaveBeenCalledTimes(2);

    expect(mockPostApi).toHaveBeenNthCalledWith(
      1,
      `/organizations/org-slug/members/`,
      expect.objectContaining({
        data: {email: 'test1@test.com', role: 'admin', teams: []},
      })
    );
    expect(mockPostApi).toHaveBeenNthCalledWith(
      2,
      `/organizations/org-slug/members/`,
      expect.objectContaining({
        data: {email: 'test2@test.com', role: 'member', teams: []},
      })
    );
  });

  it('can reset modal', async function () {
    setupView({
      mockApiResponses: [defaultMockOrganizationRoles, defaultMockPostOrganizationMember],
    });
    expect(await screen.findByRole('button', {name: 'Add another'})).toBeInTheDocument();

    await setupMemberInviteState();
    await userEvent.click(screen.getByRole('button', {name: 'Send invites (2)'}));

    // Wait for them to finish
    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 2 invites'))
    ).toBeInTheDocument();

    // Reset the modal
    await userEvent.click(screen.getByRole('button', {name: 'Send more invites'}));
    expect(screen.getByRole('button', {name: 'Send invite'})).toBeDisabled();
  });

  it('sends all successful invites with team default', async function () {
    const {mocks} = setupView({
      mockApiResponses: [defaultMockOrganizationRoles, defaultMockPostOrganizationMember],
    });

    expect(await screen.findByRole('button', {name: 'Add another'})).toBeInTheDocument();
    await setupMemberInviteState();

    await userEvent.click(screen.getByRole('button', {name: 'Send invites (2)'}));

    const mockPostApi = mocks[1];
    expect(mockPostApi).toHaveBeenCalledTimes(2);
    expect(mockPostApi).toHaveBeenNthCalledWith(
      1,
      `/organizations/org-slug/members/`,
      expect.objectContaining({
        data: {email: 'test1@test.com', role: 'admin', teams: ['team-slug']},
      })
    );
    expect(mockPostApi).toHaveBeenNthCalledWith(
      2,
      `/organizations/org-slug/members/`,
      expect.objectContaining({
        data: {email: 'test2@test.com', role: 'member', teams: ['team-slug']},
      })
    );
  });

  it('does not use defaults when there are multiple teams', async function () {
    const another_team = TeamFixture({id: '2', slug: 'team2'});
    setupView({orgTeams: [TeamFixture(), another_team]});

    expect(await screen.findByRole('button', {name: 'Add another'})).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Add another'}));
    const teamInputs = screen.getAllByRole('textbox', {name: 'Add to Team'});
    expect(teamInputs).toHaveLength(2);
    expect(teamInputs[0]).toHaveValue('');
    expect(teamInputs[1]).toHaveValue('');
  });

  it('marks failed invites', async function () {
    const failedCreateMemberMock = (client, orgSlug, _) => {
      return client.addMockResponse({
        url: `/organizations/${orgSlug}/members/`,
        method: 'POST',
        statusCode: 400,
      });
    };

    const {mocks} = setupView({
      mockApiResponses: [defaultMockOrganizationRoles, failedCreateMemberMock],
    });
    expect(
      await screen.findByRole('textbox', {name: 'Email Addresses'})
    ).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('textbox', {name: 'Email Addresses'}),
      'bademail'
    );
    await userEvent.tab();
    await userEvent.click(screen.getByRole('button', {name: 'Send invite'}));

    const failedApiMock = mocks[1];
    expect(failedApiMock).toHaveBeenCalled();

    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 0 invites, 1 failed to send.'))
    ).toBeInTheDocument();
  });

  it('can send initial email', async function () {
    const initialEmail = 'test@gmail.com';
    const initialData = [{emails: new Set([initialEmail])}];

    const {mocks} = setupView({
      mockApiResponses: [defaultMockOrganizationRoles, defaultMockPostOrganizationMember],
      modalProps: {
        ...defaultMockModalProps,
        initialData,
      },
    });

    await waitFor(() => {
      expect(screen.getByText(initialEmail)).toBeInTheDocument();
    });

    // Just immediately click send
    await userEvent.click(screen.getByRole('button', {name: 'Send invite'}));

    const apiMock = mocks[1];
    expect(apiMock).toHaveBeenCalledWith(
      `/organizations/org-slug/members/`,
      expect.objectContaining({
        data: {email: initialEmail, role: 'member', teams: ['team-slug']},
      })
    );

    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 1 invite'))
    ).toBeInTheDocument();
  });

  it('can send initial email with role and team', async function () {
    const initialEmail = 'test@gmail.com';
    const role = 'admin';
    const initialData = [
      {emails: new Set([initialEmail]), role, teams: new Set([TeamFixture().slug])},
    ];

    const {mocks} = setupView({
      mockApiResponses: [defaultMockOrganizationRoles, defaultMockPostOrganizationMember],
      modalProps: {
        ...defaultMockModalProps,
        initialData,
      },
    });

    expect(await screen.findByRole('button', {name: 'Send invite'})).toBeInTheDocument();
    // Just immediately click send
    await userEvent.click(screen.getByRole('button', {name: 'Send invite'}));

    expect(screen.getByText(initialEmail)).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();

    const apiMock = mocks[1];
    expect(apiMock).toHaveBeenCalledWith(
      `/organizations/org-slug/members/`,
      expect.objectContaining({
        data: {email: initialEmail, role, teams: [TeamFixture().slug]},
      })
    );

    expect(
      await screen.findByText(textWithMarkupMatcher('Sent 1 invite'))
    ).toBeInTheDocument();
  });

  describe('member invite request mode', function () {
    it('has adjusted wording', async function () {
      setupView({orgAccess: []});
      expect(
        await screen.findByRole('button', {name: 'Send invite request'})
      ).toBeInTheDocument();
    });

    it('POSTS to the invite-request endpoint', async function () {
      const createInviteRequestMock = (client, orgSlug, _) => {
        return client.addMockResponse({
          url: `/organizations/${orgSlug}/invite-requests/`,
          method: 'POST',
        });
      };

      // Use initial data so we don't have to setup as much stuff
      const initialEmail = 'test@gmail.com';
      const initialData = [{emails: new Set([initialEmail])}];

      const {mocks} = setupView({
        orgAccess: [],
        mockApiResponses: [defaultMockOrganizationRoles, createInviteRequestMock],
        modalProps: {
          ...defaultMockModalProps,
          initialData,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(initialEmail)).toBeInTheDocument();
      });
      await userEvent.click(screen.getByRole('button', {name: 'Send invite request'}));
      const apiMock = mocks[1];
      expect(apiMock).toHaveBeenCalledTimes(1);
    });
  });
});
