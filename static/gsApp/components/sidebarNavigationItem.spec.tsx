import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {SidebarNavigationItem} from 'getsentry/components/sidebarNavigationItem';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';

describe('SidebarNavigationItem', function () {
  let billingConfigMock: any;

  const renderFunc = jest.fn().mockImplementation(function simpleRenderFunction({
    additionalContent,
    Wrapper,
    disabled,
  }) {
    return (
      <Wrapper>
        <a data-test-id="link" aria-disabled={disabled}>
          <span>Some Content</span>
          <span>{additionalContent}</span>
        </a>
      </Wrapper>
    );
  });

  beforeEach(function () {
    const organization = OrganizationFixture();

    billingConfigMock = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });
  });

  const verifyItemIsEnabled = () => {
    expect(screen.getByTestId('link')).toHaveAttribute('aria-disabled', 'false');
    expect(screen.getByTestId('link')).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByTestId('power-icon')).not.toBeInTheDocument();
  };

  const verifyItemIsDisabled = () => {
    expect(screen.getByTestId('link')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('link')).toHaveAttribute('aria-describedby');
    expect(screen.getByTestId('power-icon')).toBeInTheDocument();
  };

  it('allows items that do not have blocking conditions', function () {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization});

    subscription.planDetails.features = [];

    const id = 'metrics';

    SubscriptionStore.set(organization.slug, subscription);

    render(
      <SidebarNavigationItem
        id={id}
        organization={organization}
        subscription={subscription}
      >
        {renderFunc}
      </SidebarNavigationItem>
    );

    verifyItemIsEnabled();
  });

  it('provides eligible items with non-blocking render props', function () {
    const organization = OrganizationFixture();

    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_business',
      isFree: true,
    });

    subscription.planDetails.features = ['insights-addon-modules'];

    const id = 'llm-monitoring';

    SubscriptionStore.set(organization.slug, subscription);

    render(
      <SidebarNavigationItem
        id={id}
        organization={organization}
        subscription={subscription}
      >
        {renderFunc}
      </SidebarNavigationItem>
    );

    verifyItemIsEnabled();
  });

  it('provides ineligible items with blocking render props', function () {
    const organization = OrganizationFixture({
      features: ['insights-initial-modules'],
    });

    const subscription = SubscriptionFixture({
      organization,
      plan: 'am2_f',
      isFree: true,
    });

    subscription.planDetails.features = [];

    const id = 'llm-monitoring';

    SubscriptionStore.set(organization.slug, subscription);

    render(
      <SidebarNavigationItem
        id={id}
        organization={organization}
        subscription={subscription}
      >
        {renderFunc}
      </SidebarNavigationItem>
    );

    verifyItemIsDisabled();
  });

  it('considers features of the plan trial', async function () {
    // The `"am3_team"` plan does not have the `insights-addon-modules` feature. The `"am3_business"` plan _does_ have the feature. The "LLM Monitoring" sidebar item should be enabled
    const organization = OrganizationFixture();

    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
      trialPlan: 'am3_business',
    });

    const id = 'llm-monitoring';

    SubscriptionStore.set(organization.slug, subscription);

    render(
      <SidebarNavigationItem
        id={id}
        organization={organization}
        subscription={subscription}
      >
        {renderFunc}
      </SidebarNavigationItem>
    );

    await waitFor(() => {
      expect(billingConfigMock).toHaveBeenCalled();
    });

    verifyItemIsEnabled();
  });

  it('considers features of the organization', async function () {
    // The `"am3_team"` plan does not have the `insights-addon-modules` feature. The organization _does_ have the feature. This can happen if the flag is manually turned on via an allowlist. "LLM Monitoring" should be enabled
    const organization = OrganizationFixture({
      features: ['insights-addon-modules'],
    });

    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
    });

    const id = 'llm-monitoring';

    SubscriptionStore.set(organization.slug, subscription);

    render(
      <SidebarNavigationItem
        id={id}
        organization={organization}
        subscription={subscription}
      >
        {renderFunc}
      </SidebarNavigationItem>
    );

    await waitFor(() => {
      expect(billingConfigMock).toHaveBeenCalled();
    });

    verifyItemIsEnabled();
  });

  it('covers "Insights" link with an upsell if no Insights are available', async function () {
    const organization = OrganizationFixture();

    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
    });

    const id = 'sidebar-accordion-insights-item';

    SubscriptionStore.set(organization.slug, subscription);

    render(
      <SidebarNavigationItem
        id={id}
        organization={organization}
        subscription={subscription}
      >
        {renderFunc}
      </SidebarNavigationItem>
    );

    await waitFor(() => {
      expect(billingConfigMock).toHaveBeenCalled();
    });

    expect(screen.getByTestId('link')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('link')).toHaveAttribute('aria-describedby');
    expect(screen.getByTestId('power-icon')).toBeInTheDocument();
  });

  it('omits Turbo icon from Insights links if none are available', async function () {
    const organization = OrganizationFixture();

    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_team',
    });

    const id = 'performance-database';

    SubscriptionStore.set(organization.slug, subscription);

    render(
      <SidebarNavigationItem
        id={id}
        organization={organization}
        subscription={subscription}
      >
        {renderFunc}
      </SidebarNavigationItem>
    );

    await waitFor(() => {
      expect(billingConfigMock).toHaveBeenCalled();
    });

    expect(screen.getByTestId('link')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByTestId('link')).toHaveAttribute('aria-describedby');
    expect(screen.queryByTestId('power-icon')).not.toBeInTheDocument();
  });
});
