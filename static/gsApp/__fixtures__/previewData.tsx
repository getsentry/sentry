import type {PreviewData} from 'getsentry/types';
import {InvoiceItemType} from 'getsentry/types';

export function PreviewDataFixture(fields: Partial<PreviewData>): PreviewData {
  return {
    atPeriodEnd: false,
    balanceChange: 0,
    billedAmount: 0,
    creditApplied: 0,
    effectiveAt: '2023-01-01T00:00:00Z',
    invoiceItems: [
      {
        amount: 8900,
        type: InvoiceItemType.SUBSCRIPTION,
        description: 'Subscription to Business',
        data: {},
        period_end: '',
        period_start: '',
      },
    ],
    newBalance: -10000,
    previewToken: '1:2023-01-01T00:00:00',
    proratedAmount: 0,
    ...fields,
  };
}
