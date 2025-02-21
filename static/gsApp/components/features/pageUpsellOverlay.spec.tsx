import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageUpsellOverlay from 'getsentry/components/features/pageUpsellOverlay';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

describe('PageUpsellOverlay', function () {
  let wrapper: any;
  afterEach(function () {
    if (wrapper) {
      wrapper.unmount();
    }
    wrapper = null;
  });

  const org = OrganizationFixture({access: ['org:billing']});
  MockApiClient.addMockResponse({
    url: `/customers/${org.slug}/billing-config/?tier=am2`,
    body: BillingConfigFixture(PlanTier.AM2),
  });

  it('renders customSecondaryCTA', function () {
    const subscription = SubscriptionFixture({
      organization: org,
      canSelfServe: true,
      canTrial: false,
    });
    SubscriptionStore.set(org.slug, subscription);

    wrapper = render(
      <PageUpsellOverlay
        organization={org}
        customSecondaryCTA="My Text"
        features={[]}
        name=""
        positioningStrategy={jest.fn()}
        description=""
        requiredPlan=""
        source=""
      />
    );
    expect(screen.queryByText('Learn More')).not.toBeInTheDocument();
    expect(screen.getByText('My Text')).toBeInTheDocument();
    expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
  });
  it('renders learn more', function () {
    const subscription = SubscriptionFixture({
      organization: org,
      canSelfServe: true,
      canTrial: false,
    });
    SubscriptionStore.set(org.slug, subscription);

    wrapper = render(
      <PageUpsellOverlay
        organization={org}
        features={[]}
        name=""
        positioningStrategy={jest.fn()}
        description=""
        requiredPlan=""
        source=""
      />
    );
    expect(screen.getByText('Learn More')).toBeInTheDocument();
    expect(screen.getByText('Upgrade Plan')).toBeInTheDocument();
  });
  it('does not render CTA for non-self serve', function () {
    const subscription = SubscriptionFixture({
      organization: org,
      canSelfServe: false,
      canTrial: false,
    });
    SubscriptionStore.set(org.slug, subscription);

    wrapper = render(
      <PageUpsellOverlay
        organization={org}
        features={[]}
        name=""
        positioningStrategy={jest.fn()}
        description=""
        requiredPlan=""
        source=""
      />
    );
    expect(screen.getByText('Learn More')).toBeInTheDocument();
    expect(screen.queryByText('Upgrade Plan')).not.toBeInTheDocument();
  });
});
