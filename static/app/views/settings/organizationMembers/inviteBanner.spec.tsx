import {browserHistory} from 'react-router';
import moment from 'moment';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {MissingMember} from 'sentry/types';
import {DEFAULT_SNOOZE_PROMPT_DAYS} from 'sentry/utils/promptIsDismissed';
import {InviteBanner} from 'sentry/views/settings/organizationMembers/inviteBanner';

const missingMembers = {
  integration: 'github',
  users: TestStubs.MissingMembers() as MissingMember[],
};

const noMissingMembers = {
  integration: 'github',
  users: [] as MissingMember[],
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
    (browserHistory.push as jest.Mock).mockReset();
  });

  it('does not render banner if no missing members', async function () {
    const org = TestStubs.Organization({
      features: ['integrations-gh-invite'],
    });

    render(
      <InviteBanner
        missingMembers={noMissingMembers}
        onSendInvite={() => undefined}
        organization={org}
      />
    );

    await act(tick);

    expect(screen.queryByTestId('invite-banner')).not.toBeInTheDocument();
  });

  it('does not render banner if lacking org:write', async function () {
    const org = TestStubs.Organization({
      features: ['integrations-gh-invite'],
      access: [],
    });

    render(
      <InviteBanner
        missingMembers={noMissingMembers}
        onSendInvite={() => undefined}
        organization={org}
      />
    );

    await act(tick);

    expect(screen.queryByTestId('invite-banner')).not.toBeInTheDocument();
  });

  it('renders banner if snoozed_ts days is longer than threshold', async function () {
    const org = TestStubs.Organization({
      features: ['integrations-gh-invite'],
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
        onSendInvite={() => undefined}
        organization={org}
      />
    );

    await act(tick);

    expect(screen.queryByTestId('invite-banner')).toBeInTheDocument();
  });

  it('does not render banner if snoozed_ts days is shorter than threshold', async function () {
    const org = TestStubs.Organization({
      features: ['integrations-gh-invite'],
    });
    const promptResponse = {
      dismissed_ts: undefined,
      snoozed_ts: moment
        .utc()
        .subtract(DEFAULT_SNOOZE_PROMPT_DAYS - 1, 'days')
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
        onSendInvite={() => undefined}
        organization={org}
      />
    );

    await act(tick);

    expect(screen.queryByTestId('invite-banner')).not.toBeInTheDocument();
  });
});
