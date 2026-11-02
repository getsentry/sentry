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
        SubscriptionFixture({organization, canSelfServe: true})
      )
    );
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/event-limit-increase-request/`,
      method: 'POST',
    });

    render(<SeerOutOfCreditsCta />, {organization});

    expect(screen.queryByRole('button', {name: 'Top up'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Request credits'}));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/event-limit-increase-request/`,
        expect.objectContaining({data: expect.objectContaining({types: ['seerAutofix']})})
      )
    );
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
