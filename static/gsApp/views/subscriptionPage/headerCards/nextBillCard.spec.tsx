import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {PreviewDataFixture} from 'getsentry/__fixtures__/previewData';
import {InvoiceItemType} from 'getsentry/types';
import NextBillCard from 'getsentry/views/subscriptionPage/headerCards/nextBillCard';

describe('NextBillCard', () => {
  const organization = OrganizationFixture({access: ['org:billing']});

  beforeEach(() => {
    setMockDate(new Date('2021-03-03'));
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/next-bill/`,
      method: 'GET',
    });
  });

  afterEach(() => {
    resetMockDate();
  });

  it('renders for no bill', async () => {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
      onDemandPeriodEnd: '2021-03-05',
    });
    render(<NextBillCard organization={organization} subscription={subscription} />);

    // falls back to next on-demand period start
    await screen.findByText('Mar 6, 2021・in 3 days');
    expect(screen.getByText('$0.00')).toBeInTheDocument();
    expect(screen.queryByText(/plan/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Pay-as-you-go/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Tax/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Credits/)).not.toBeInTheDocument();
  });

  it('renders for bill', async () => {
    const mockNextBill = PreviewDataFixture({
      effectiveAt: '2021-03-31',
      creditApplied: 10_00,
      billedAmount: 123_50,
      invoiceItems: [
        {
          amount: 89_00,
          type: InvoiceItemType.SUBSCRIPTION,
          description: 'Subscription to Business',
          data: {
            plan: 'am3_business',
          },
          period_start: '',
          period_end: '',
        },
        {
          amount: 7_50,
          type: InvoiceItemType.RESERVED_REPLAYS,
          data: {},
          period_start: '',
          period_end: '',
          description: 'Reserved replays',
        },
        {
          amount: 5_00,
          type: InvoiceItemType.RESERVED_ATTACHMENTS,
          data: {},
          period_start: '',
          period_end: '',
          description: 'Reserved attachments',
        },
        {
          amount: 1_00,
          type: InvoiceItemType.ONDEMAND_ERRORS,
          data: {},
          period_start: '',
          period_end: '',
          description: 'Pay-as-you-go errors',
        },
        {
          amount: 11_00,
          type: InvoiceItemType.ONDEMAND_REPLAYS,
          data: {},
          period_start: '',
          period_end: '',
          description: 'Pay-as-you-go errors',
        },
        {
          amount: 20_00,
          type: InvoiceItemType.SALES_TAX,
          data: {},
          period_start: '',
          period_end: '',
          description: 'GST/HST',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/next-bill/`,
      method: 'GET',
      body: mockNextBill,
    });
    const subscription = SubscriptionFixture({
      organization,
      plan: 'am3_business',
    });
    render(<NextBillCard organization={organization} subscription={subscription} />);

    await screen.findByText('Mar 31, 2021・in 28 days');
    expect(screen.getByText('$123.50')).toBeInTheDocument();
    expect(screen.getByText('Monthly plan')).toBeInTheDocument();
    expect(screen.getByText('$101.50')).toBeInTheDocument();
    expect(screen.getByText('Pay-as-you-go')).toBeInTheDocument();
    expect(screen.getByText('$12.00')).toBeInTheDocument();
    expect(screen.getByText('GST/HST')).toBeInTheDocument(); // uses the tax item description
    expect(screen.getByText('$20.00')).toBeInTheDocument();
    expect(screen.getByText('Credits')).toBeInTheDocument();
    expect(screen.getByText('-$10.00')).toBeInTheDocument();
  });

  it('renders alert for error', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/next-bill/`,
      method: 'GET',
      statusCode: 400,
    });
    const subscription = SubscriptionFixture({
      organization,
      onDemandPeriodEnd: '2021-03-16',
    });
    render(<NextBillCard organization={organization} subscription={subscription} />);

    await screen.findByText('Mar 17, 2021・in 14 days'); // still falls back to next on-demand period end
    await screen.findByText('Could not compute next bill. Please try again later.');
  });
});
