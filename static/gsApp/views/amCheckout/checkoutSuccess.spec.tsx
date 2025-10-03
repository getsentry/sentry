import moment from 'moment-timezone';

import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {render, screen} from 'sentry-test/reactTestingLibrary';
import {resetMockDate, setMockDate} from 'sentry-test/utils';

import {PreviewDataFixture} from 'getsentry/__fixtures__/previewData';
import CheckoutSuccess from 'getsentry/views/amCheckout/checkoutSuccess';

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
});
