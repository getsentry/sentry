import {BillingHistoryFixture} from 'getsentry-test/fixtures/billingHistory';
import {MetricHistoryFixture} from 'getsentry-test/fixtures/metricHistory';

import {DataCategory} from 'sentry/types/core';

import {InvoiceUsagePeriod} from 'getsentry/views/invoiceDetails/usage';

const usage = BillingHistoryFixture({
  plan: 'am3_team',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  onDemandMaxSpend: 5000,
  onDemandSpend: 838,
  categories: {
    errors: MetricHistoryFixture({
      category: DataCategory.ERRORS,
      usage: 62_000,
      reserved: 50_000,
      prepaid: 55_000,
      free: 5_000,
      onDemandSpendUsed: 254,
    }),
    replays: MetricHistoryFixture({
      category: DataCategory.REPLAYS,
      usage: 1_180,
      reserved: 50,
      prepaid: 50,
      onDemandSpendUsed: 424,
    }),
    spans: MetricHistoryFixture({
      category: DataCategory.SPANS,
      usage: 5_800_000,
      reserved: 5_000_000,
      prepaid: 5_000_000,
      onDemandSpendUsed: 160,
    }),
    attachments: MetricHistoryFixture({
      category: DataCategory.ATTACHMENTS,
      usage: 620_000_000,
      reserved: 1,
      prepaid: 1,
    }),
  },
});

describe('InvoiceUsagePeriod', () => {
  it.snapshot.each<number>([390, 1024])(
    'with-pay-as-you-go',
    () => <InvoiceUsagePeriod usage={usage} />,
    width => ({viewport: width, tags: {area: 'billing'}})
  );
});
