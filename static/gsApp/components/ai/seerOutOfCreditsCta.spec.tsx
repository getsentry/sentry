import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

import {SeerOutOfCreditsCta} from './seerOutOfCreditsCta';

describe('SeerOutOfCreditsCta', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('lets billing members top up from the billing overview', () => {
    const organization = OrganizationFixture({access: ['org:read', 'org:billing']});
    act(() =>
      SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}))
    );

    render(<SeerOutOfCreditsCta />, {organization});

    expect(
      screen.getByText(/Your organization is out of Seer credits/)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Top up'})).toHaveAttribute(
      'href',
      `/settings/${organization.slug}/billing/overview/`
    );
    expect(
      screen.queryByRole('button', {name: 'Request credits'})
    ).not.toBeInTheDocument();
  });

  it('lets other members of self-serve orgs request credits', async () => {
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

    render(<SeerOutOfCreditsCta />, {organization});

    expect(screen.queryByRole('button', {name: 'Top up'})).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', {name: 'Request credits'}));

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
    expect(await screen.findByRole('button', {name: 'Request sent'})).toBeDisabled();
  });

  it('shows the request as sent for the rest of the billing period', async () => {
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

    render(<SeerOutOfCreditsCta />, {organization});

    expect(await screen.findByRole('button', {name: 'Request sent'})).toBeDisabled();
    expect(
      screen.queryByRole('button', {name: 'Request credits'})
    ).not.toBeInTheDocument();
  });

  it('lets members request again once a new billing period starts', async () => {
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

    render(<SeerOutOfCreditsCta />, {organization});

    await waitFor(() => expect(prompts).toHaveBeenCalled());
    expect(screen.getByRole('button', {name: 'Request credits'})).toBeEnabled();
    expect(screen.queryByRole('button', {name: 'Request sent'})).not.toBeInTheDocument();
  });

  it('offers no request to members of orgs that cannot self-serve', () => {
    const organization = OrganizationFixture({access: ['org:read']});
    act(() =>
      SubscriptionStore.set(
        organization.slug,
        SubscriptionFixture({organization, canSelfServe: false})
      )
    );

    render(<SeerOutOfCreditsCta />, {organization});

    expect(
      screen.getByText(/Ask someone with billing access in your organization/)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('replaces the headline with a custom message', () => {
    const organization = OrganizationFixture({access: ['org:read', 'org:billing']});
    act(() =>
      SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}))
    );

    render(<SeerOutOfCreditsCta message="Seer stopped part way." />, {organization});

    expect(screen.getByText(/Seer stopped part way\./)).toBeInTheDocument();
    expect(
      screen.queryByText(/Your organization is out of Seer credits/)
    ).not.toBeInTheDocument();
  });
});
