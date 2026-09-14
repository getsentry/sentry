import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {BillingInfoCard} from 'getsentry/views/subscriptionPage/headerCards/billingInfoCard';

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
    const subscription = SubscriptionFixture({organization, accountBalance: 10_00});
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Billing information')).toBeInTheDocument();
    await screen.findByText('Test company, Display Address');
    expect(screen.getByText('Billing email: test@gmail.com')).toBeInTheDocument();
    expect(screen.getByText('Visa ending in 4242')).toBeInTheDocument();
    // a positive balance is owed, not credit
    expect(screen.getByText('Balance due: $10')).toBeInTheDocument();
  });

  it('renders with some pre-existing info', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture({billingEmail: null, companyName: null}),
    });
    const subscription = SubscriptionFixture({organization, accountBalance: -10_00});
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Billing information')).toBeInTheDocument();
    await screen.findByText('Display Address');
    expect(screen.queryByText('Test company')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing email: test@gmail.com')).not.toBeInTheDocument();
    expect(
      screen.getByText('No billing email or tax number on file')
    ).toBeInTheDocument();
    expect(screen.getByText('Visa ending in 4242')).toBeInTheDocument();
    expect(screen.getByText('Account credits: $10')).toBeInTheDocument();
  });

  it('renders without pre-existing info', async () => {
    const subscription = SubscriptionFixture({
      organization,
      paymentSource: null,
      accountBalance: 0,
    });
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    expect(screen.getByText('Billing information')).toBeInTheDocument();
    await screen.findByText('No billing details on file');
    expect(screen.getByText('No payment method on file')).toBeInTheDocument();
    expect(screen.queryByText(/Account credits/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Balance due/)).not.toBeInTheDocument();
  });

  it('renders the account credit without billing details or a payment method', async () => {
    const subscription = SubscriptionFixture({
      organization,
      paymentSource: null,
      accountBalance: -10_00,
    });
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    expect(await screen.findByText('No billing details on file')).toBeInTheDocument();
    expect(screen.getByText('No payment method on file')).toBeInTheDocument();
    // the credit comes off the subscription, so it renders regardless of what
    // billing details or payment method are on file
    expect(screen.getByText('Account credits: $10')).toBeInTheDocument();
  });

  it('renders the account credit when only non-address details are on file', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture({
        addressLine1: null,
        addressLine2: null,
        city: null,
        region: null,
        postalCode: null,
        countryCode: null,
        displayAddress: null,
        addressType: null,
      }),
    });
    const subscription = SubscriptionFixture({organization, accountBalance: -10_00});
    render(<BillingInfoCard organization={organization} subscription={subscription} />);

    // hasSomeBillingDetails() ignores the email/company/tax fields, so this org
    // still falls into the empty state
    expect(await screen.findByText('No billing details on file')).toBeInTheDocument();
    expect(screen.getByText('Account credits: $10')).toBeInTheDocument();
  });
});
