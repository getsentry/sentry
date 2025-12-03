import type {PreviewData} from 'getsentry/types';

export function InvoicePreviewFixture(params: Partial<PreviewData> = {}): PreviewData {
  return {
    atPeriodEnd: false,
    balanceChange: 0,
    proratedAmount: 8900,
    billedAmount: 8900,
    creditApplied: 0,
    newBalance: 0,
    effectiveAt: '2020-06-08T05:01:02.304299Z',
    previewToken: '1:2020-06-08T05:01:02',
    invoiceItems: [
      {
        amount: 8900,
        data: {plan: 'am1_business'},
        description: 'Subscription to Business',
        period_end: '2020-07-07',
        period_start: '2020-06-08',
        type: 'subscription',
      },
      {
        amount: 0,
        data: {quantity: 50000},
        description: '50,000 prepaid errors',
        period_end: '2020-07-07',
        period_start: '2020-06-08',
        type: 'reserved_errors',
      },
      {
        amount: 0,
        data: {quantity: 150000},
        description: '150,000 prepaid transactions',
        period_end: '2020-07-07',
        period_start: '2020-06-08',
        type: 'reserved_transactions',
      },
      {
        amount: 0,
        data: {quantity: 5},
        description: '5 GB prepaid attachments',
        period_end: '2020-07-07',
        period_start: '2020-06-08',
        type: 'reserved_attachments',
      },
    ],
    ...params,
  };
}
