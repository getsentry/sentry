import {MemoryRouter} from 'react-router';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {InvoiceFixture} from 'getsentry-test/fixtures/invoice';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';

import {ContainerQueryContext} from '@sentry/scraps/layout';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {OrganizationContext} from 'sentry/utils/organizationContext';

import {OnDemandBudgetMode, type InvoiceUsage} from 'getsentry/types';
import {ReceiptTable} from 'getsentry/views/subscriptionPage/paymentHistory';

const organization = OrganizationFixture({
  slug: 'acme',
  access: ['org:billing'],
  features: ['invoice-usage-downloads'],
});

const csv = 'https://sentry.io/organizations/acme/billing/contracts/1/export/';
const expandedReceipt = InvoiceFixture({
  isClosed: true,
  isPaid: true,
  usageCsvLinks: {csv, csvPerProject: `${csv}per-project/`},
});
const otherReceipt = InvoiceFixture({
  id: '9f8e7d6c5b4a',
  dateCreated: '2018-05-25T12:00:00Z',
  isClosed: true,
  isPaid: true,
});

const usage = BillingHistoryFixture({
  plan: 'am3_team',
  isCurrent: false,
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  onDemandMaxSpend: 10_000,
  onDemandSpend: 2_500,
  onDemandBudgetMode: OnDemandBudgetMode.SHARED,
  categories: {
    errors: MetricHistoryFixture({
      usage: 30_000,
      reserved: 50_000,
      free: 10_000,
      prepaid: 60_000,
      onDemandSpendUsed: 2_500,
    }),
  },
});

// SSR runs no requests, so the usage of the expanded receipt is put in the cache.
function makeQueryClient() {
  const queryClient = new QueryClient({defaultOptions: {queries: {gcTime: Infinity}}});
  const {queryKey} = apiOptions.as<InvoiceUsage>()(
    '/customers/$organizationIdOrSlug/invoices/$invoiceId/usage/',
    {
      path: {organizationIdOrSlug: organization.slug, invoiceId: expandedReceipt.id},
      staleTime: Infinity,
    }
  );
  queryClient.setQueryData(queryKey, {json: usage, headers: {}});
  return queryClient;
}

describe('ReceiptTable', () => {
  describe.each([
    {viewport: 390, breakpoint: '2xs'},
    {viewport: 1152, breakpoint: '4xl'},
  ] as const)('container width $viewport', ({viewport, breakpoint}) => {
    it.snapshot(
      'expanded usage',
      () => (
        <MemoryRouter>
          <QueryClientProvider client={makeQueryClient()}>
            <OrganizationContext value={organization}>
              {/* SSR does not run the container measurement effect. */}
              <ContainerQueryContext value={breakpoint}>
                <ReceiptTable
                  initialExpandedId={expandedReceipt.id}
                  isError={false}
                  isPending={false}
                  onRetry={() => {}}
                  organization={organization}
                  payments={[expandedReceipt, otherReceipt]}
                />
              </ContainerQueryContext>
            </OrganizationContext>
          </QueryClientProvider>
        </MemoryRouter>
      ),
      {viewport, tags: {area: 'billing'}}
    );
  });
});
