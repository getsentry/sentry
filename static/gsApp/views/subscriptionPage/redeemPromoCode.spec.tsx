import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import RedeemPromoCode from 'getsentry/views/redeemPromoCode';

describe('Redeem promo code', () => {
  const organization = OrganizationFixture({access: ['org:billing']});

  beforeEach(() => {
    SubscriptionStore.set(organization.slug, {});
  });

  it('renders redeem promo code page', () => {
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(<RedeemPromoCode />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/subscription/redeem-code/`,
        },
        route: '/settings/:orgId/subscription/redeem-code/',
      },
    });
    expect(screen.queryAllByText('Redeem Promotional Code')).toHaveLength(2);
  });

  it('does not render redeem promo code page for YY partnership orgs', async () => {
    const subscription = SubscriptionFixture({
      plan: 'am2_business',
      planTier: 'am2',
      partner: {
        externalId: 'x123x',
        name: 'YY Org',
        partnership: {
          id: 'YY',
          displayName: 'YY',
          supportNote: 'foo',
        },
        isActive: true,
      },
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(<RedeemPromoCode />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/subscription/redeem-code/`,
        },
        route: '/settings/:orgId/subscription/redeem-code/',
      },
    });
    expect(await screen.findByTestId('partnership-note')).toBeInTheDocument();
    expect(screen.queryByText('Redeem Promotional Code')).not.toBeInTheDocument();
  });

  it('submits promo code successfully', async () => {
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);

    const mockPut = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/redeem-promo/`,
      method: 'PUT',
      body: {details: 'Credit applied!'},
    });

    // Mock endpoints called by fetchOrganizationDetails and SubscriptionStore.loadData
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/`,
      body: subscription,
    });

    render(<RedeemPromoCode />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: `/settings/${organization.slug}/subscription/redeem-code/`,
        },
        route: '/settings/:orgId/subscription/redeem-code/',
      },
    });

    await userEvent.type(
      screen.getByRole('textbox', {name: 'Promotional Code'}),
      'TEST-PROMO-123'
    );
    await userEvent.click(screen.getByRole('button', {name: 'Redeem'}));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        `/customers/${organization.slug}/redeem-promo/`,
        expect.objectContaining({
          method: 'PUT',
          data: {code: 'TEST-PROMO-123'},
        })
      );
    });
  });
});
