import moment from 'moment-timezone';
import {MemberFixture} from 'sentry-fixture/member';
import {MissingMembersFixture} from 'sentry-fixture/missingMembers';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as modal from 'sentry/actionCreators/modal';
import {DEFAULT_SNOOZE_PROMPT_DAYS} from 'sentry/utils/promptIsDismissed';

import {InviteBanner} from './inviteBanner';

const missingMembers = {
  integration: 'github',
  enabled: true,
  users: MissingMembersFixture(),
};

const noMissingMembers = {
  integration: 'github',
  enabled: true,
  users: [],
};

const nudgeDisabled = {
  integration: 'github',
  enabled: false,
  users: [],
};

describe('inviteBanner', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [missingMembers],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/prompts-activity/',
      method: 'GET',
      body: {
        dismissed_ts: undefined,
        snoozed_ts: undefined,
      },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('render banners', async () => {
    const org = OrganizationFixture();

    render(
      <InviteBanner onSendInvite={() => {}} allowedRoles={[]} onModalClose={() => {}} />,
      {organization: org}
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId('invite-missing-member')).toHaveLength(5);
    expect(screen.getByText('See all 5 missing members')).toBeInTheDocument();
  });

  it('does not render banner if nudge_invite is disabled', async () => {
    const org = OrganizationFixture();

    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [nudgeDisabled],
    });

    const {container} = render(
      <InviteBanner onSendInvite={() => {}} allowedRoles={[]} onModalClose={() => {}} />,
      {organization: org}
    );

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render banner if no missing members', async () => {
    const org = OrganizationFixture();

    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [noMissingMembers],
    });

    const {container} = render(
      <InviteBanner onSendInvite={() => {}} allowedRoles={[]} onModalClose={() => {}} />,
      {organization: org}
    );

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render banner if no integration', async () => {
    const org = OrganizationFixture();

    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [],
    });

    const {container} = render(
      <InviteBanner onSendInvite={() => {}} allowedRoles={[]} onModalClose={() => {}} />,
      {organization: org}
    );

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render banner if lacking org:write', () => {
    const org = OrganizationFixture({access: []});

    const {container} = render(
      <InviteBanner onSendInvite={() => {}} allowedRoles={[]} onModalClose={() => {}} />,
      {organization: org}
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders banner if snoozed_ts days is longer than threshold', async () => {
    const org = OrganizationFixture();
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: moment
        .utc()
        .subtract(DEFAULT_SNOOZE_PROMPT_DAYS + 1, 'days')
        .unix(),
    };
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/prompts-activity/`,
      method: 'GET',
      body: {data: promptResponse},
    });

    render(
      <InviteBanner onSendInvite={() => {}} allowedRoles={[]} onModalClose={() => {}} />,
      {organization: org}
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).toBeInTheDocument();
  });

  it('does not render banner if snoozed_ts days is shorter than threshold', async () => {
    const org = OrganizationFixture();
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: moment
        .utc()
        .subtract(DEFAULT_SNOOZE_PROMPT_DAYS - 1, 'days')
        .unix(),
    };
    const mockPrompt = MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/prompts-activity/`,
      method: 'GET',
      body: {data: promptResponse},
    });

    const {container} = render(
      <InviteBanner onSendInvite={() => {}} allowedRoles={[]} onModalClose={() => {}} />,
      {organization: org}
    );

    await waitFor(() => expect(mockPrompt).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('invites member from banner', async () => {
    const newMember = MemberFixture({
      id: '6',
      email: 'hello@sentry.io',
      teams: [],
      teamRoles: [],
      flags: {
        'idp:provisioned': false,
        'idp:role-restricted': false,
        'member-limit:restricted': false,
        'partnership:restricted': false,
        'sso:invalid': false,
        'sso:linked': true,
      },
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [
        {
          integration: 'github',
          enabled: true,
          users: MissingMembersFixture().slice(0, 5),
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/?referrer=github_nudge_invite',
      method: 'POST',
      body: newMember,
    });

    const org = OrganizationFixture();

    render(
      <InviteBanner onSendInvite={() => {}} allowedRoles={[]} onModalClose={() => {}} />,
      {organization: org}
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId('invite-missing-member')).toHaveLength(5);
    expect(screen.getByText('See all 5 missing members')).toBeInTheDocument();

    const inviteButton = screen.queryAllByTestId('invite-missing-member')[0]!;
    await userEvent.click(inviteButton);
    expect(screen.queryAllByTestId('invite-missing-member')).toHaveLength(4);
    expect(screen.getByText('See all 4 missing members')).toBeInTheDocument();
  });

  it('opens the invite modal when inviteMissingMembers is in the URL', async () => {
    const openModal = jest
      .spyOn(modal, 'openInviteMissingMembersModal')
      .mockResolvedValue(undefined);

    render(
      <InviteBanner onSendInvite={() => {}} allowedRoles={[]} onModalClose={() => {}} />,
      {
        organization: OrganizationFixture(),
        initialRouterConfig: {
          location: {
            pathname: '/settings/org-slug/members/',
            query: {inviteMissingMembers: 'true'},
          },
        },
      }
    );

    await waitFor(() =>
      expect(openModal).toHaveBeenLastCalledWith(
        expect.objectContaining({missingMembers: missingMembers.users})
      )
    );
  });

  it('does not reopen the invite modal when an unrelated query param changes', async () => {
    const openModal = jest
      .spyOn(modal, 'openInviteMissingMembersModal')
      .mockResolvedValue(undefined);
    const onModalClose = jest.fn();
    const onSendInvite = jest.fn();
    const allowedRoles: never[] = [];

    const {router} = render(
      <InviteBanner
        onSendInvite={onSendInvite}
        allowedRoles={allowedRoles}
        onModalClose={onModalClose}
      />,
      {
        organization: OrganizationFixture(),
        initialRouterConfig: {
          location: {
            pathname: '/settings/org-slug/members/',
            query: {inviteMissingMembers: 'true'},
          },
        },
      }
    );
    await waitFor(() =>
      expect(openModal).toHaveBeenLastCalledWith(
        expect.objectContaining({missingMembers: missingMembers.users})
      )
    );
    const callCount = openModal.mock.calls.length;

    act(() =>
      router.navigate('/settings/org-slug/members/?inviteMissingMembers=true&query=foo')
    );

    await waitFor(() => expect(router.location.query.query).toBe('foo'));
    expect(openModal).toHaveBeenCalledTimes(callCount);
  });
});
