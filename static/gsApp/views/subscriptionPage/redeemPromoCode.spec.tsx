import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import RedeemPromoCode from 'getsentry/views/redeemPromoCode';

describe('Redeem promo code', () => {
  const organization = OrganizationFixture({access: ['org:billing']});
  const {router} = initializeOrg({
    organization,
  });
  beforeEach(function () {
    SubscriptionStore.set(organization.slug, {});
  });

  it('renders redeem promo code page', function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_f',
      planTier: PlanTier.AM1,
      organization,
    });
    SubscriptionStore.set(organization.slug, subscription);
    render(
      <RedeemPromoCode
        router={router}
        location={router.location}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
        params={{orgId: organization.slug}}
      />,
      {
        router,
        organization,
      }
    );
    expect(screen.queryAllByText('Redeem Promotional Code')).toHaveLength(2);
  });

  it('does not render redeem promo code page for YY partnership orgs', async function () {
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
    render(
      <RedeemPromoCode
        router={router}
        location={router.location}
        routes={router.routes}
        routeParams={router.params}
        route={{}}
        params={{orgId: organization.slug}}
      />,
      {
        router,
        organization,
      }
    );
    expect(await screen.findByTestId('partnership-note')).toBeInTheDocument();
    expect(screen.queryByText('Redeem Promotional Code')).not.toBeInTheDocument();
  });
});
