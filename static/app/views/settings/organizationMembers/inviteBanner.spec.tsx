import moment from 'moment-timezone';
import {MemberFixture} from 'sentry-fixture/member';
import {MissingMembersFixture} from 'sentry-fixture/missingMembers';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DEFAULT_SNOOZE_PROMPT_DAYS} from 'sentry/utils/promptIsDismissed';
import {InviteBanner} from 'sentry/views/settings/organizationMembers/inviteBanner';

const missingMembers = {
  integration: 'github',
  users: MissingMembersFixture(),
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
      url: '/organizations/org-slug/prompts-activity/',
      method: 'GET',
      body: {
        dismissed_ts: undefined,
        snoozed_ts: undefined,
      },
    });
  });

  it('render banners', async function () {
    const org = OrganizationFixture({
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

  it('does not render banner if no option', function () {
    const org = OrganizationFixture();

    const {container} = render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('does not render banner if no missing members', async function () {
    const org = OrganizationFixture({
      githubNudgeInvite: true,
    });

    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [noMissingMembers],
    });

    const {container} = render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render banner if no integration', async function () {
    const org = OrganizationFixture({
      githubNudgeInvite: true,
    });

    const mock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/missing-members/',
      method: 'GET',
      body: [],
    });

    const {container} = render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    await waitFor(() => expect(mock).toHaveBeenCalledTimes(1));
    expect(container).toBeEmptyDOMElement();
  });

  it('does not render banner if lacking org:write', function () {
    const org = OrganizationFixture({
      access: [],
      githubNudgeInvite: true,
    });

    const {container} = render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('renders banner if snoozed_ts days is longer than threshold', async function () {
    const org = OrganizationFixture({
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
      url: `/organizations/${org.slug}/prompts-activity/`,
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
    const org = OrganizationFixture({
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
      url: `/organizations/${org.slug}/prompts-activity/`,
      method: 'GET',
      body: {data: promptResponse},
    });

    const {container} = render(
      <InviteBanner
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    await waitFor(() => expect(mockPrompt).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('invites member from banner', async function () {
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
          users: MissingMembersFixture().slice(0, 5),
        },
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/?referrer=github_nudge_invite',
      method: 'POST',
      body: newMember,
    });

    const org = OrganizationFixture({
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

    const inviteButton = screen.queryAllByTestId('invite-missing-member')[0]!;
    await userEvent.click(inviteButton);
    expect(screen.queryAllByTestId('invite-missing-member')).toHaveLength(4);
    expect(screen.getByText('See all 4 missing members')).toBeInTheDocument();
  });
});
