import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

import {SeerOutOfCreditsCta} from './seerOutOfCreditsCta';

describe('SeerOutOfCreditsCta', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  function mockAutoTopUp(organization: Organization, enabled: boolean) {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/auto-top-up/`,
      body: {
        enabled,
        thresholdCredits: 500,
        topUpCredits: 1000,
        dailySpendCapCents: 7500,
      },
    });
  }

  it('lets billing members turn on auto-reload from the chat in a modal', async () => {
    const organization = OrganizationFixture({access: ['org:read', 'org:billing']});
    act(() =>
      SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}))
    );
    mockAutoTopUp(organization, false);
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/seer-wallet/`,
      body: {
        balance: 0,
        creditPriceCents: 1,
        percentUsed: 1,
        included: {total: 500, remaining: 0, resetsAt: null},
        purchased: {total: 0, remaining: 0, expiresAt: null},
      },
    });

    render(<SeerOutOfCreditsCta reason="agent-chat" denialReason={null} />, {
      organization,
    });
    renderGlobalModal({organization});

    expect(
      await screen.findByText(
        'Your organization does not have enough credits left for you to message Seer. Adjust your spend and turn on auto-reload.'
      )
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Turn on auto-reload'}));
    expect(
      await screen.findByRole('heading', {name: 'Auto-reload credits'})
    ).toBeInTheDocument();
    expect(screen.getByRole('radiogroup', {name: 'Credit amount'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Contact Admin'})).not.toBeInTheDocument();
  });

  it('tells billing members with auto-reload on that the org hit its daily usage limit', async () => {
    const organization = OrganizationFixture({access: ['org:read', 'org:billing']});
    act(() =>
      SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}))
    );
    mockAutoTopUp(organization, true);

    render(<SeerOutOfCreditsCta reason="agent-chat" denialReason={null} />, {
      organization,
    });

    // Nothing shows until the setting loads, so the "off" copy never flashes.
    expect(screen.queryByTestId('seer-out-of-credits')).not.toBeInTheDocument();
    // Auto-reload tops the org up until the daily usage limit stops it.
    expect(
      await screen.findByText(
        'Your organization hit its daily usage limit, so you cannot continue messaging Seer.'
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Configure auto-reload'})
    ).toBeInTheDocument();
  });

  it('tells billing members when the chat hit the daily usage limit', async () => {
    const organization = OrganizationFixture({access: ['org:read', 'org:billing']});
    act(() =>
      SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}))
    );
    // Auto-reload being off doesn't matter: the limit stopped the chat, and
    // it's set alongside auto-reload.
    mockAutoTopUp(organization, false);

    render(
      <SeerOutOfCreditsCta reason="agent-chat" denialReason="daily_cap_exceeded" />,
      {organization}
    );

    expect(
      await screen.findByText(
        'Your organization hit its daily usage limit, so you cannot continue messaging Seer.'
      )
    ).toBeInTheDocument();
    // Tests run in UTC with the clock frozen at 2017-10-17T02:41:20Z, so the
    // limit resets at the next midnight UTC.
    expect(screen.getByTestId('seer-out-of-credits')).toHaveTextContent(
      'This will reset at 12:00 AM UTC.'
    );
    expect(
      screen.getByRole('button', {name: 'Configure auto-reload'})
    ).toBeInTheDocument();
  });

  it('tells members to ask their admin about the daily usage limit', () => {
    const organization = OrganizationFixture({access: ['org:read']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({organization, canSelfServe: true})
      )
    );

    render(
      <SeerOutOfCreditsCta reason="agent-chat" denialReason="daily_cap_exceeded" />,
      {organization}
    );

    expect(
      screen.getByText(
        'Your organization hit its daily usage limit, so you cannot continue messaging Seer. If you want to increase your limit, reach out to your admin.'
      )
    ).toBeInTheDocument();
    // "Contact Admin" asks for credits, which won't lift the limit.
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('tells members when Autofix hit the daily usage limit', () => {
    const organization = OrganizationFixture({access: ['org:read']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({organization, canSelfServe: true})
      )
    );

    render(
      <SeerOutOfCreditsCta
        reason="autofix-start"
        denialReason="daily_cap_exceeded"
        variant="muted"
      />,
      {organization}
    );

    expect(
      screen.getByText(
        'Your organization hit its daily usage limit, so you cannot start an Autofix run. If you want to increase your limit, reach out to your admin.'
      )
    ).toBeInTheDocument();
  });

  it.each([
    [
      'autofix-start',
      'You do not have enough credits to start an Autofix run. Set up auto-reload to keep your flow uninterrupted.',
    ],
    [
      'autofix-continue',
      'Your organization does not have enough credits to continue your Autofix run. Set up auto-reload to keep your flow uninterrupted.',
    ],
  ] as const)('uses the %s copy', async (reason, copy) => {
    const organization = OrganizationFixture({access: ['org:read', 'org:billing']});
    act(() =>
      SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}))
    );
    mockAutoTopUp(organization, false);

    render(<SeerOutOfCreditsCta reason={reason} denialReason={null} />, {organization});

    expect(await screen.findByText(copy)).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Configure auto-reload'})
    ).toBeInTheDocument();
  });

  it('lets other members of self-serve orgs email their admins', async () => {
    const organization = OrganizationFixture({access: ['org:read']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        // Tests run with the clock frozen at 2017-10-17, inside this period.
        SubscriptionFixture({
          organization,
          canSelfServe: true,
          onDemandPeriodStart: '2017-10-01',
        })
      )
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });
    const snooze = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      method: 'PUT',
    });
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/seer-top-up-request/`,
      method: 'POST',
    });

    render(<SeerOutOfCreditsCta reason="agent-chat" denialReason={null} />, {
      organization,
    });

    expect(
      await screen.findByText(
        'Your organization does not have enough credits left for you to message Seer.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Turn on auto-reload'})
    ).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: 'Contact Admin'}));

    await waitFor(() => expect(request).toHaveBeenCalled());
    expect(snooze).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/prompts-activity/`,
      expect.objectContaining({
        data: expect.objectContaining({
          feature: 'seer_top_up_requested',
          status: 'snoozed',
        }),
      })
    );
    expect(await screen.findByRole('button', {name: 'Admins emailed'})).toBeDisabled();
  });

  it.each([
    [
      'autofix-start',
      'Your organization does not have enough credits to start an Autofix run. Ask your admin to increase your daily usage limit or set up auto-reload.',
    ],
    [
      'autofix-continue',
      'Your organization does not have enough credits to continue your Autofix run. Ask your admin to increase your daily usage limit or set up auto-reload.',
    ],
  ] as const)('uses the member %s copy', async (reason, copy) => {
    const organization = OrganizationFixture({access: ['org:read']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({organization, canSelfServe: true})
      )
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {},
    });

    render(<SeerOutOfCreditsCta reason={reason} denialReason={null} variant="muted" />, {
      organization,
    });

    expect(await screen.findByText(copy)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Contact Admin'})).toBeEnabled();
  });

  it('shows the admins as emailed for the rest of the billing period', async () => {
    const organization = OrganizationFixture({access: ['org:read']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({
          organization,
          canSelfServe: true,
          onDemandPeriodStart: '2018-09-25',
        })
      )
    );
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {
        features: {
          seer_top_up_requested: {snoozed_ts: new Date('2018-10-01').getTime() / 1000},
        },
      },
    });

    render(<SeerOutOfCreditsCta reason="agent-chat" denialReason={null} />, {
      organization,
    });

    // "Contact Admin" can't be clicked before the earlier request has loaded.
    expect(screen.queryByRole('button', {name: 'Contact Admin'})).not.toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Admins emailed'})).toBeDisabled();
    expect(screen.queryByRole('button', {name: 'Contact Admin'})).not.toBeInTheDocument();
  });

  it('lets members email their admins again once a new billing period starts', async () => {
    const organization = OrganizationFixture({access: ['org:read']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({
          organization,
          canSelfServe: true,
          onDemandPeriodStart: '2018-09-25',
        })
      )
    );
    const prompts = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prompts-activity/`,
      body: {
        features: {
          seer_top_up_requested: {snoozed_ts: new Date('2018-09-01').getTime() / 1000},
        },
      },
    });

    render(<SeerOutOfCreditsCta reason="agent-chat" denialReason={null} />, {
      organization,
    });

    expect(await screen.findByRole('button', {name: 'Contact Admin'})).toBeEnabled();
    expect(prompts).toHaveBeenCalled();
    expect(
      screen.queryByRole('button', {name: 'Admins emailed'})
    ).not.toBeInTheDocument();
  });

  it('offers no button to members of orgs that cannot self-serve', () => {
    const organization = OrganizationFixture({access: ['org:read']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({organization, canSelfServe: false})
      )
    );

    render(<SeerOutOfCreditsCta reason="agent-chat" denialReason={null} />, {
      organization,
    });

    expect(screen.getByText(/Ask your admin to set up auto-reload/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
