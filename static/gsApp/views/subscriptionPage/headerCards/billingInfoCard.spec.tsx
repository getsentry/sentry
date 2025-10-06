import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import BillingInfoCard from 'getsentry/views/subscriptionPage/headerCards/billingInfoCard';

describe('BillingInfoCard', () => {
  const organization = OrganizationFixture({access: ['org:billing']});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
  });

  it('renders with pre-existing info', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
    const subscription = SubscriptionFixture({organization});
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Billing information')).toBeInTheDocument();
    await screen.findByText('Test company');
    expect(screen.getByText('Card ending in 4242')).toBeInTheDocument();
  });

  it('renders without pre-existing info', async () => {
    const subscription = SubscriptionFixture({organization, paymentSource: null});
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Billing information')).toBeInTheDocument();
    await screen.findByText('No billing details on file');
    expect(screen.getByText('No payment method on file')).toBeInTheDocument();
  });

  it('does not render for self-serve partner customers', () => {
    const subscription = SubscriptionFixture({organization, isSelfServePartner: true});
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    expect(screen.queryByText('Billing information')).not.toBeInTheDocument();
  });

  it('does not render for managed customers', () => {
    const subscription = SubscriptionFixture({organization, canSelfServe: false});
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    expect(screen.queryByText('Billing information')).not.toBeInTheDocument();
  });

  it('renders for managed customers with legacy invoiced OD', () => {
    const subscription = SubscriptionFixture({
      organization,
      canSelfServe: false,
      onDemandInvoiced: true,
    });
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Billing information')).toBeInTheDocument();
  });
});
