import moment from 'moment';
import {MissingMembers} from 'sentry-fixture/missingMembers';
import {Organization} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
      body: [],
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
        missingMembers={missingMembers}
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
    expect(screen.getByText('See all 7 missing members')).toBeInTheDocument();
  });

  it('does not render banner if no feature flag', function () {
    const org = Organization({
      features: [],
    });

    render(
      <InviteBanner
        missingMembers={missingMembers}
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

  it('does not render banner if no missing members', function () {
    const org = Organization({
      features: ['integrations-gh-invite'],
    });

    render(
      <InviteBanner
        missingMembers={noMissingMembers}
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

  it('does not render banner if lacking org:write', function () {
    const org = Organization({
      features: ['integrations-gh-invite'],
      access: [],
    });

    render(
      <InviteBanner
        missingMembers={noMissingMembers}
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
        missingMembers={missingMembers}
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

  it('does not render banner if snoozed_ts days is shorter than threshold', function () {
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

    render(
      <InviteBanner
        missingMembers={missingMembers}
        onSendInvite={() => {}}
        organization={org}
        allowedRoles={[]}
        onModalClose={() => {}}
      />
    );

    expect(mockPrompt).toHaveBeenCalled();
    expect(
      screen.queryByRole('heading', {
        name: 'Bring your full GitHub team on board in Sentry',
      })
    ).not.toBeInTheDocument();
  });
});
