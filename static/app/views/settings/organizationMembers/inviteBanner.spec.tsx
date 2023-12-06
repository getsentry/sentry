import moment from 'moment';
import {Member} from 'sentry-fixture/member';
import {MissingMembers} from 'sentry-fixture/missingMembers';
import {Organization} from 'sentry-fixture/organization';

import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {DEFAULT_SNOOZE_PROMPT_DAYS} from 'sentry/utils/promptIsDismissed';
import {InviteBanner} from 'sentry/views/settings/organizationMembers/inviteBanner';

const missingMembers = {
  integration: 'github',
  users: MissingMembers(),
};

const noMissingMembers = {
  integration: 'github',
  users: [],
};

describe('inviteBanner', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [missingMembers],
    });
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      method: 'GET',
      body: {
        dismissed_ts: undefined,
        snoozed_ts: undefined,
      },
    });
  });

  it('render banners with feature flag', async function () {
    const org = Organization({
      features: ['integrations-gh-invite'],
      githubNudgeInvite: true,
    });

    render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId('invite-missing-member')).toHaveLength(5);
    expect(screen.getByText('See all 5 missing members')).toBeInTheDocument();
  });

  it('does not render banner if no feature flag', function () {
    const org = Organization({
      features: [],
    });

    render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    expect(
      screen.queryByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).not.toBeInTheDocument();
  });

  it('does not render banner if no option', function () {
    const org = Organization({
      features: ['integrations-gh-invite'],
    });

    render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    expect(
      screen.queryByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).not.toBeInTheDocument();
  });

  it('does not render banner if no missing members', async function () {
    const org = Organization({
      features: ['integrations-gh-invite'],
      githubNudgeInvite: true,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [noMissingMembers],
    });

    await act(async () => {
      await render(
        <InviteBanner
          onSendInvite={() => {}}
          organization={org}
          allowedRoles={[]}
          onModalClose={() => {}}
        />
      );
    });

    expect(
      screen.queryByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).not.toBeInTheDocument();
  });

  it('does not render banner if no integration', async function () {
    const org = Organization({
      features: ['integrations-gh-invite'],
      githubNudgeInvite: true,
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [],
    });

    await act(async () => {
      await render(
        <InviteBanner
          onSendInvite={() => {}}
          organization={org}
          allowedRoles={[]}
          onModalClose={() => {}}
        />
      );
    });

    expect(
      screen.queryByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).not.toBeInTheDocument();
  });

  it('does not render banner if lacking org:write', async function () {
    const org = Organization({
      features: ['integrations-gh-invite'],
      access: [],
      githubNudgeInvite: true,
    });

    await act(async () => {
      await render(
        <InviteBanner
          onSendInvite={() => {}}
          organization={org}
          allowedRoles={[]}
          onModalClose={() => {}}
        />
      );
    });

    expect(
      screen.queryByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).not.toBeInTheDocument();
  });

  it('renders banner if snoozed_ts days is longer than threshold', async function () {
    const org = Organization({
      features: ['integrations-gh-invite'],
      githubNudgeInvite: true,
    });
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: moment
        .utc()
        .subtract(DEFAULT_SNOOZE_PROMPT_DAYS + 1, 'days')
        .unix(),
    };
    MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      method: 'GET',
      body: {data: promptResponse},
    });

    render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).toBeInTheDocument();
  });

  it('does not render banner if snoozed_ts days is shorter than threshold', async function () {
    const org = Organization({
      features: ['integrations-gh-invite'],
      githubNudgeInvite: true,
    });
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: moment
        .utc()
        .subtract(DEFAULT_SNOOZE_PROMPT_DAYS - 1, 'days')
        .unix(),
    };
    const mockPrompt = MockApiClient.addMockResponse({
      url: '/prompts-activity/',
      method: 'GET',
      body: {data: promptResponse},
    });

    await act(async () => {
      await render(
        <InviteBanner
          onSendInvite={() => {}}
          organization={org}
          allowedRoles={[]}
          onModalClose={() => {}}
        />
      );
    });

    expect(mockPrompt).toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).not.toBeInTheDocument();
  });

  it('invites member from banner', async function () {
    const newMember = Member({
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
          users: MissingMembers().slice(0, 5),
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/?referrer=github_nudge_invite',
      method: 'POST',
      body: newMember,
    });

    const org = Organization({
      features: ['integrations-gh-invite'],
      githubNudgeInvite: true,
    });

    render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    expect(
      await screen.findByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId('invite-missing-member')).toHaveLength(5);
    expect(screen.getByText('See all 5 missing members')).toBeInTheDocument();

    const inviteButton = screen.queryAllByTestId('invite-missing-member')[0];
    await userEvent.click(inviteButton);
    expect(screen.queryAllByTestId('invite-missing-member')).toHaveLength(4);
    expect(screen.getByText('See all 4 missing members')).toBeInTheDocument();
  });
});
