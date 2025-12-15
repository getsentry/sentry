import moment from 'moment-timezone';

import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {PreviewDataFixture} from 'getsentry/__fixtures__/previewData';
import CheckoutSuccess from 'getsentry/views/amCheckout/components/checkoutSuccess';

describe('CheckoutSuccess', () => {
  const bizPlan = PlanDetailsLookupFixture('am3_business')!;
  const mockDate = new Date('2025-01-01');

  beforeEach(() => {
    setMockDate(mockDate);
  });

  afterEach(() => {
    resetMockDate();
  });

  it('renders for immediate charges', async () => {
    render(
      <CheckoutSuccess
        invoice={InvoiceFixture()}
        basePlan={bizPlan}
        nextQueryParams={[]}
      />
    );

    expect(
      await screen.findByText('Pleasure doing business with you')
    ).toBeInTheDocument();
    expect(screen.getByTestId('receipt')).toBeInTheDocument();
    expect(screen.queryByTestId('scheduled-changes')).not.toBeInTheDocument();
  });

  it('renders for scheduled changes', async () => {
    render(
      <CheckoutSuccess
        basePlan={bizPlan}
        nextQueryParams={[]}
        previewData={PreviewDataFixture({
          effectiveAt: moment(mockDate).add(1, 'day').toISOString(),
        })}
      />
    );

    expect(await screen.findByText('Consider it done (soon)')).toBeInTheDocument();
    expect(screen.getByTestId('scheduled-changes')).toBeInTheDocument();
    expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
  });

  it('renders for no immediate charges nor scheduled changes', async () => {
    render(
      <CheckoutSuccess
        basePlan={bizPlan}
        nextQueryParams={[]}
        previewData={PreviewDataFixture({
          effectiveAt: moment(mockDate).subtract(1, 'day').toISOString(),
        })}
      />
    );

    expect(await screen.findByText('Consider it done')).toBeInTheDocument();
    expect(screen.queryByTestId('scheduled-changes')).not.toBeInTheDocument();
    expect(screen.queryByTestId('receipt')).not.toBeInTheDocument();
  });

  it('renders ondemand items in receipt', async () => {
    const invoiceWithOnDemand = InvoiceFixture({
      items: [
        {
          type: 'subscription',
          description: 'Subscription to Team Plan',
          amount: 31200,
          data: {quantity: null},
          periodStart: '2025-01-01T00:00:00Z',
          periodEnd: '2026-01-01T00:00:00Z',
        },
        {
          type: 'ondemand_errors',
          description: '4,901,066 pay-as-you-go errors',
          amount: 94022,
          data: {quantity: 4901066},
          periodStart: '2025-01-01T00:00:00Z',
          periodEnd: '2026-01-01T00:00:00Z',
        },
        {
          type: 'ondemand_monitor_seats',
          description: '2 pay-as-you-go cron monitors',
          amount: 156,
          data: {quantity: 2},
          periodStart: '2025-01-01T00:00:00Z',
          periodEnd: '2026-01-01T00:00:00Z',
        },
      ],
    });

    render(
      <CheckoutSuccess
        invoice={invoiceWithOnDemand}
        basePlan={bizPlan}
        nextQueryParams={[]}
      />
    );

    expect(await screen.findByText('Pay-as-you-go usage')).toBeInTheDocument();
    expect(screen.getByText('4,901,066 errors')).toBeInTheDocument();
    expect(screen.getByText('2 cron monitors')).toBeInTheDocument();
    expect(screen.getByText('$940.22')).toBeInTheDocument();
    expect(screen.getByText('$1.56')).toBeInTheDocument();
  });
});
